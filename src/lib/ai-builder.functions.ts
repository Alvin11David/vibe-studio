import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STARTER_FILES, type ProjectFiles } from "./project-files";

const SYSTEM_PROMPT = `You are Aurum, an elite AI app builder that produces beautiful, working multi-file React + TypeScript projects.

OUTPUT CONTRACT — call the "emit_project" tool exactly once with:
- summary: ONE short imperative line (e.g. "Added pricing grid & dark hero").
- files: object mapping file path -> file source. Required entry: "App.tsx" exporting default a React component.
- Optional files: any "components/Whatever.tsx", "lib/foo.ts", and a single optional "index.css" with custom CSS.

RUNTIME CONSTRAINTS — the project runs in a sandboxed browser with NO build step. The runtime provides:
- React 19 (use \`import React from "react"\` only when needed; JSX automatic runtime).
- react-dom/client.
- Tailwind CSS via CDN (use Tailwind utility classes freely).
- lucide-react icons (\`import { Sparkles } from "lucide-react"\`).
- NO other npm packages — do not import anything else.
- NO Node APIs, NO file system, NO process.env.
- Use relative paths between files: \`import Hero from "./components/Hero"\`.
- Images: use https://images.unsplash.com or https://picsum.photos URLs.

QUALITY BAR — make it visually striking and responsive. Use modern layouts, tasteful typography, generous spacing, and subtle motion (CSS transitions only). Dark mode by default unless asked otherwise.

ITERATION — when iterating on an existing project you receive PRIOR_FILES. Preserve everything you are not asked to change. Return the FULL updated file set (do not return diffs).

If the user selects an element via visual edit, you receive the element's tag and outerHTML — change ONLY that element and return the full updated file set.`;

const InputSchema = z.object({
  projectId: z.string().uuid(),
  message: z.string().min(1).max(8000),
  imageDataUrl: z.string().optional(),
  selection: z
    .object({ tag: z.string(), outerHtml: z.string().max(4000), text: z.string().max(1000) })
    .optional(),
});

const FILES_TOOL = {
  type: "function" as const,
  function: {
    name: "emit_project",
    description: "Emit the complete multi-file React project for the user request.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "One short line describing what changed." },
        files: {
          type: "object",
          description: "Map of file path to source code. Must include 'App.tsx'.",
          additionalProperties: { type: "string" },
        },
      },
      required: ["summary", "files"],
      additionalProperties: false,
    },
  },
};

export const generateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: project } = await supabase
      .from("projects")
      .select("id,title,files")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Response("Project not found", { status: 404 });

    const { data: spent, error: spendErr } = await supabaseAdmin.rpc("spend_credit", {
      _user_id: userId,
      _kind: "ai_generation",
      _description: `Generation in ${project.title}`,
    });
    if (spendErr) throw new Response("Credit error", { status: 500 });
    if (!spent) {
      return { error: "out_of_credits" as const, message: "You're out of credits. Buy a pack or wait for tomorrow's free 5." };
    }

    const { data: userMsg } = await supabaseAdmin
      .from("messages")
      .insert({
        project_id: data.projectId,
        user_id: userId,
        role: "user",
        content: data.message,
        image_url: data.imageDataUrl ?? null,
      })
      .select("id")
      .single();

    const { data: history } = await supabaseAdmin
      .from("messages")
      .select("role,content")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: true })
      .limit(16);

    const priorFiles = (project.files as ProjectFiles) ?? {};
    const hasPrior = Object.keys(priorFiles).length > 0;

    const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT }];
    if (hasPrior) {
      messages.push({
        role: "system",
        content: `PRIOR_FILES:\n\n${JSON.stringify(priorFiles, null, 2).slice(0, 60000)}`,
      });
    }
    for (const m of (history ?? []).slice(0, -1)) {
      messages.push({ role: m.role, content: m.content });
    }

    let userContent: any = data.message;
    if (data.selection) {
      userContent = `User selected element <${data.selection.tag}>:\n\`\`\`\n${data.selection.outerHtml}\n\`\`\`\nVisible text: "${data.selection.text}"\n\nThey want: ${data.message}`;
    }
    if (data.imageDataUrl) {
      userContent = [
        { type: "text", text: typeof userContent === "string" ? userContent : data.message },
        { type: "image_url", image_url: { url: data.imageDataUrl } },
      ];
    }
    messages.push({ role: "user", content: userContent });

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Response("AI not configured", { status: 500 });

    const startedAt = Date.now();
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: data.imageDataUrl ? "google/gemini-2.5-pro" : "google/gemini-3-flash-preview",
        messages,
        tools: [FILES_TOOL],
        tool_choice: { type: "function", function: { name: "emit_project" } },
      }),
    });

    if (res.status === 429)
      return { error: "rate_limit" as const, message: "Too many requests. Please wait a moment." };
    if (res.status === 402)
      return { error: "payment_required" as const, message: "AI credits exhausted on the gateway." };
    if (!res.ok) {
      console.error("AI error", res.status, await res.text());
      return { error: "ai_error" as const, message: "AI temporarily unavailable." };
    }

    const json: any = await res.json();
    const thoughtMs = Date.now() - startedAt;
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    let summary = "Updated your app.";
    let files: ProjectFiles = {};
    try {
      const parsed = JSON.parse(call?.function?.arguments ?? "{}");
      summary = String(parsed.summary || summary);
      files = (parsed.files || {}) as ProjectFiles;
    } catch (e) {
      console.error("Failed to parse tool args", e);
      return { error: "ai_error" as const, message: "AI returned malformed output. Try again." };
    }
    if (!files["App.tsx"]) {
      return { error: "ai_error" as const, message: "AI did not return App.tsx. Try again." };
    }

    // Save assistant message
    const { data: asstMsg } = await supabaseAdmin
      .from("messages")
      .insert({
        project_id: data.projectId,
        user_id: userId,
        role: "assistant",
        content: summary,
      })
      .select("id")
      .single();

    // Snapshot version
    const { data: version } = await supabaseAdmin
      .from("project_versions")
      .insert({
        project_id: data.projectId,
        user_id: userId,
        message_id: asstMsg?.id ?? null,
        files: files as any,
        summary,
        thought_ms: thoughtMs,
      })
      .select("id,created_at")
      .single();

    await supabaseAdmin
      .from("projects")
      .update({ files: files as any, updated_at: new Date().toISOString() })
      .eq("id", data.projectId);

    return {
      ok: true as const,
      summary,
      files,
      thoughtMs,
      versionId: version?.id ?? null,
      messageId: asstMsg?.id ?? null,
      userMessageId: userMsg?.id ?? null,
    };
  });

const RestoreSchema = z.object({ versionId: z.string().uuid(), projectId: z.string().uuid() });

export const restoreVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RestoreSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: v } = await supabase
      .from("project_versions")
      .select("files,summary")
      .eq("id", data.versionId)
      .eq("project_id", data.projectId)
      .maybeSingle();
    if (!v) throw new Response("Not found", { status: 404 });

    const { data: asstMsg } = await supabaseAdmin
      .from("messages")
      .insert({
        project_id: data.projectId,
        user_id: userId,
        role: "assistant",
        content: `Restored: ${v.summary}`,
      })
      .select("id")
      .single();

    const { data: version } = await supabaseAdmin
      .from("project_versions")
      .insert({
        project_id: data.projectId,
        user_id: userId,
        message_id: asstMsg?.id ?? null,
        files: v.files as any,
        summary: `Restored: ${v.summary}`,
        thought_ms: 0,
      })
      .select("id")
      .single();

    await supabaseAdmin.from("projects").update({ files: v.files as any }).eq("id", data.projectId);
    return { ok: true as const, files: v.files as ProjectFiles, versionId: version?.id, messageId: asstMsg?.id };
  });

// Seed starter files if a fresh project has none.
export const ensureProjectFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: project } = await supabase
      .from("projects")
      .select("files")
      .eq("id", data.projectId)
      .maybeSingle();
    const files = (project?.files as ProjectFiles) ?? {};
    if (Object.keys(files).length === 0) {
      await supabaseAdmin.from("projects").update({ files: STARTER_FILES as any }).eq("id", data.projectId);
      return { files: STARTER_FILES };
    }
    return { files };
  });
