import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SYSTEM_PROMPT = `You are Aurum, an elite AI app builder.

Your job: produce a SINGLE self-contained HTML file that renders a beautiful, working web app based on the user's request.

STRICT OUTPUT FORMAT:
- Respond with ONLY a single fenced code block: \`\`\`html ... \`\`\`
- Inside it: a complete HTML document with embedded <style> and <script>
- Use Tailwind CSS via the CDN: <script src="https://cdn.tailwindcss.com"></script>
- For images, use https://images.unsplash.com/... search URLs or https://picsum.photos
- Make it responsive, polished, and visually striking. Dark mode preferred unless asked otherwise.
- Use Google Fonts where appropriate.
- All JS must work without a build step.
- If the user is iterating on an existing app, MODIFY the previous HTML preserving everything except what they asked to change.

Before the fenced block, write ONE short sentence explaining what you built (e.g. "Built a moody architect portfolio with a parallax hero.").
Never include instructions, never explain the code, never show partial files. Output the FULL HTML every time.`;

const InputSchema = z.object({
  projectId: z.string().uuid(),
  message: z.string().min(1).max(8000),
  imageDataUrl: z.string().optional(),
});

export const generateApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify project ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id,current_code,title")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Response("Project not found", { status: 404 });

    // Spend credit BEFORE calling AI
    const { data: spent, error: spendErr } = await supabaseAdmin.rpc("spend_credit", {
      _user_id: userId, _kind: "ai_generation", _description: `Generation in ${project.title}`,
    });
    if (spendErr) throw new Response("Credit error", { status: 500 });
    if (!spent) {
      return { error: "out_of_credits", message: "You're out of credits. Upgrade or wait for tomorrow's free 5." };
    }

    // Persist user message
    await supabaseAdmin.from("messages").insert({
      project_id: data.projectId, user_id: userId, role: "user",
      content: data.message, image_url: data.imageDataUrl ?? null,
    });

    // Load recent message history
    const { data: history } = await supabaseAdmin
      .from("messages")
      .select("role,content")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: true })
      .limit(20);

    const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT }];
    if (project.current_code) {
      messages.push({ role: "system", content: `CURRENT APP HTML (modify this):\n\n${project.current_code}` });
    }
    for (const m of history ?? []) {
      messages.push({ role: m.role, content: m.content });
    }

    // Append vision content for the latest user message if image present
    if (data.imageDataUrl) {
      // Replace last user msg with vision content
      messages[messages.length - 1] = {
        role: "user",
        content: [
          { type: "text", text: data.message },
          { type: "image_url", image_url: { url: data.imageDataUrl } },
        ],
      };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Response("AI not configured", { status: 500 });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: data.imageDataUrl ? "google/gemini-2.5-pro" : "google/gemini-3-flash-preview",
        messages,
      }),
    });

    if (res.status === 429) return { error: "rate_limit", message: "Too many requests. Please wait a moment." };
    if (res.status === 402) return { error: "payment_required", message: "AI service needs more credits. Contact support." };
    if (!res.ok) {
      console.error("AI error", res.status, await res.text());
      return { error: "ai_error", message: "AI temporarily unavailable." };
    }

    const json: any = await res.json();
    const reply: string = json.choices?.[0]?.message?.content ?? "";

    // Extract HTML
    const match = reply.match(/```html\s*([\s\S]*?)```/i);
    const html = match ? match[1].trim() : "";
    const summary = match ? reply.slice(0, match.index).trim() || "Updated your app." : reply;

    // Save assistant message
    await supabaseAdmin.from("messages").insert({
      project_id: data.projectId, user_id: userId, role: "assistant", content: reply,
    });

    if (html) {
      await supabaseAdmin.from("projects").update({ current_code: html }).eq("id", data.projectId);
    }

    return { ok: true, summary, html };
  });
