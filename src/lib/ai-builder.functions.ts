import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STARTER_FILES, type ProjectFiles } from "./project-files";

const SYSTEM_PROMPT = `You are Aurum, an elite AI app builder. You build REAL, working, interactive React + TypeScript applications from scratch — like Lovable or Replit. You are NOT a landing-page generator and NOT a clone factory. Interpret each request literally and build whatever the user asks for: tools, games, dashboards, editors, calculators, trackers, chat UIs, kanban boards, drawing apps, simulators, marketing sites, internal tools, anything.

OUTPUT CONTRACT — call the "emit_project" tool exactly once with:
- summary: ONE short imperative line (e.g. "Added drag-and-drop kanban with localStorage").
- files: object mapping file path -> file source. Required entry: "App.tsx" exporting default a React component.
- Optional files: any "components/Whatever.tsx", "hooks/useThing.ts", "lib/foo.ts", and a single optional "index.css".

BUILD REAL APPS, NOT MOCKUPS:
- Wire up real state with useState/useReducer/useEffect/useMemo/useRef/useContext.
- Persist data to localStorage when it makes sense (todos, notes, settings, game scores).
- Implement actual logic: form validation, filtering, sorting, search, drag-and-drop (HTML5 DnD), keyboard shortcuts, computed values, timers, undo/redo.
- For multi-screen apps use internal state-based routing (a "view" state + conditional render), not URL routing.
- Buttons must DO something. Forms must submit. Inputs must update state. Never ship dead UI.
- Split into multiple components/files once a screen exceeds ~150 lines.

RUNTIME CONSTRAINTS — the project runs in a sandboxed browser with NO build step. The runtime provides:
- React 19 with all hooks (JSX automatic runtime; import React only when needed for types).
- react-dom/client.
- Tailwind CSS via CDN — use utility classes freely.
- lucide-react icons (\`import { Sparkles } from "lucide-react"\`).
- NO other npm packages. NO react-router, NO zustand, NO framer-motion, NO shadcn. Roll your own.
- NO Node APIs, NO process.env, NO fetch to private APIs (public CORS-enabled APIs are fine).
- Use relative paths between files: \`import Hero from "./components/Hero"\`.
- Images: https://images.unsplash.com or https://picsum.photos.

QUALITY BAR — visually polished AND functionally complete. Responsive, accessible (labels, aria, keyboard), tasteful spacing, subtle CSS transitions. Match the theme to the app: dark for dev tools/dashboards, light for docs/productivity, vivid for games/creative. Don't default to dark gradients unless the user asks.

ITERATION — when iterating you receive PRIOR_FILES. Preserve everything you are not asked to change. Return the FULL updated file set (no diffs).

If the user selects an element via visual edit, change ONLY that element and return the full updated file set.`;

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

    // Heuristic: complex/long requests get the bigger model, which has higher output token ceilings.
    const lastUser = typeof data.message === "string" ? data.message : "";
    const isComplex =
      !!data.imageDataUrl ||
      lastUser.length > 400 ||
      /landing|pricing|dashboard|sections?|multi|faq|footer|hero|grid|accordion/i.test(lastUser);

    const callModel = async (model: string) => {
      return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          tools: [FILES_TOOL],
          tool_choice: { type: "function", function: { name: "emit_project" } },
          max_tokens: 16000,
        }),
      });
    };

    const startedAt = Date.now();
    let chosenModel = isComplex ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
    let res = await callModel(chosenModel);

    if (res.status === 429)
      return { error: "rate_limit" as const, message: "Too many requests. Please wait a moment." };
    if (res.status === 402)
      return { error: "payment_required" as const, message: "AI credits exhausted on the gateway." };
    if (!res.ok) {
      console.error("AI error", res.status, await res.text());
      return { error: "ai_error" as const, message: "AI temporarily unavailable." };
    }

    const parseResponse = (json: any) => {
      const choice = json.choices?.[0];
      const call = choice?.message?.tool_calls?.[0];
      const finish = choice?.finish_reason;
      let summary = "Updated your app.";
      let files: ProjectFiles = {};
      try {
        const parsed = JSON.parse(call?.function?.arguments ?? "{}");
        summary = String(parsed.summary || summary);
        const raw = (parsed.files || {}) as Record<string, unknown>;
        for (const [k, v] of Object.entries(raw)) {
          if (typeof v !== "string") continue;
          let path = k.replace(/^\.\//, "").replace(/^\/+/, "");
          if (path.startsWith("src/")) path = path.slice(4);
          files[path] = v;
        }
      } catch (e) {
        console.error("Failed to parse tool args", e, "finish:", finish);
      }
      if (!files["App.tsx"]) {
        const alias = ["app.tsx", "App.jsx", "app.jsx", "App.ts", "index.tsx", "Index.tsx", "main.tsx"]
          .find((k) => files[k]);
        if (alias) {
          files["App.tsx"] = files[alias];
          delete files[alias];
        }
      }
      return { summary, files, finish, call };
    };

    let json: any = await res.json();
    let { summary, files, finish, call } = parseResponse(json);

    // Retry once with Pro (higher output ceiling) if Flash truncated or missed App.tsx.
    if (!files["App.tsx"] && chosenModel !== "google/gemini-2.5-pro") {
      console.warn("Retrying with gemini-2.5-pro. finish:", finish, "keys:", Object.keys(files));
      chosenModel = "google/gemini-2.5-pro";
      res = await callModel(chosenModel);
      if (res.ok) {
        json = await res.json();
        ({ summary, files, finish, call } = parseResponse(json));
      }
    }

    const thoughtMs = Date.now() - startedAt;
    if (!files["App.tsx"]) {
      console.error("AI did not return App.tsx. Keys:", Object.keys(files), "raw call:", JSON.stringify(call).slice(0, 800));
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
