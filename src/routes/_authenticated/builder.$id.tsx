import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  generateProject,
  restoreVersion,
  ensureProjectFiles,
} from "@/lib/ai-builder.functions";
import { bundleProject, buildPreviewSrcDoc } from "@/lib/bundler";
import type { ProjectFiles } from "@/lib/project-files";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Send,
  Sparkles,
  ImagePlus,
  Loader2,
  Eye,
  Code2,
  Coins,
  RotateCcw,
  MousePointerClick,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/_authenticated/builder/$id")({
  component: Builder,
  head: () => ({ meta: [{ title: "Builder — Aurum.dev" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    initial: typeof s.initial === "string" ? s.initial : undefined,
  }),
});

interface Msg {
  id: string;
  role: string;
  content: string;
  image_url?: string | null;
  created_at: string;
  // client-only enrichments
  versionId?: string | null;
  thoughtMs?: number;
  files?: ProjectFiles;
  streaming?: boolean;
}

interface Selection { tag: string; outerHtml: string; text: string }

function Builder() {
  const { id } = useParams({ from: "/_authenticated/builder/$id" });
  const search = Route.useSearch();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [files, setFiles] = useState<ProjectFiles>({});
  const [activeFiles, setActiveFiles] = useState<ProjectFiles | null>(null);
  const [title, setTitle] = useState("");
  const [input, setInput] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [editMode, setEditMode] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [bundleCode, setBundleCode] = useState("");
  const [bundleErrors, setBundleErrors] = useState<string[]>([]);
  const [bundling, setBundling] = useState(false);

  const generate = useServerFn(generateProject);
  const restore = useServerFn(restoreVersion);
  const ensureFiles = useServerFn(ensureProjectFiles);

  const sentInitial = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load project + history
  useEffect(() => {
    (async () => {
      const [{ data: project }, { data: msgs }, { data: versions }] = await Promise.all([
        supabase.from("projects").select("title,files").eq("id", id).maybeSingle(),
        supabase.from("messages").select("id,role,content,image_url,created_at").eq("project_id", id).order("created_at"),
        supabase.from("project_versions").select("id,message_id,files,thought_ms").eq("project_id", id).order("created_at"),
      ]);
      if (project) {
        setTitle(project.title);
        const f = (project.files as ProjectFiles) || {};
        setFiles(f);
        setActiveFiles(f);
      }
      if (msgs) {
        const versionByMsg = new Map<string, any>();
        for (const v of versions ?? []) if (v.message_id) versionByMsg.set(v.message_id, v);
        setMessages(
          (msgs as any[]).map((m) => ({
            ...m,
            versionId: versionByMsg.get(m.id)?.id ?? null,
            thoughtMs: versionByMsg.get(m.id)?.thought_ms ?? 0,
            files: versionByMsg.get(m.id)?.files as ProjectFiles | undefined,
          }))
        );
      }
      // Seed starter files if none
      const cur = (project?.files as ProjectFiles) || {};
      if (Object.keys(cur).length === 0) {
        const r: any = await ensureFiles({ data: { projectId: id } });
        if (r?.files) { setFiles(r.files); setActiveFiles(r.files); }
      }
    })();
  }, [id]);

  // Bundle whenever activeFiles changes
  useEffect(() => {
    if (!activeFiles || Object.keys(activeFiles).length === 0) return;
    let cancelled = false;
    (async () => {
      setBundling(true);
      const { code, errors } = await bundleProject(activeFiles);
      if (cancelled) return;
      setBundleCode(code);
      setBundleErrors(errors);
      setBundling(false);
    })();
    return () => { cancelled = true; };
  }, [activeFiles]);

  // Visual-edit message bridge
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "aurum:select" && editMode) {
        setSelection({ tag: e.data.tag, outerHtml: e.data.outerHtml, text: e.data.text });
        setEditMode(false);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [editMode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // Auto-send initial prompt
  useEffect(() => {
    if (search.initial && !sentInitial.current && title) {
      sentInitial.current = true;
      send(search.initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.initial, title]);

  const send = async (text?: string, image?: string | null) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setBusy(true);
    setInput("");
    setImageDataUrl(null);
    const sel = selection;
    setSelection(null);

    const tempId = `tmp-${Date.now()}`;
    const startedAt = Date.now();
    setMessages((m) => [
      ...m,
      { id: tempId, role: "user", content: message, image_url: image ?? null, created_at: new Date().toISOString() },
      { id: `${tempId}-a`, role: "assistant", content: "", created_at: new Date().toISOString(), streaming: true, thoughtMs: 0 },
    ]);

    // Animated thought timer
    const tickHandle = setInterval(() => {
      setMessages((m) => m.map((x) => (x.id === `${tempId}-a` ? { ...x, thoughtMs: Date.now() - startedAt } : x)));
    }, 200);

    try {
      const result: any = await generate({
        data: { projectId: id, message, imageDataUrl: image ?? undefined, selection: sel ?? undefined },
      });
      clearInterval(tickHandle);
      if (result.error) {
        toast.error(result.message);
        setMessages((m) =>
          m.filter((x) => x.id !== `${tempId}-a`).concat({
            id: `err-${Date.now()}`,
            role: "assistant",
            content: result.error === "out_of_credits" ? "You're out of credits. [Buy a pack →](/pricing)" : result.message,
            created_at: new Date().toISOString(),
          })
        );
      } else {
        setMessages((m) =>
          m.map((x) =>
            x.id === `${tempId}-a`
              ? {
                  id: result.messageId ?? x.id,
                  role: "assistant",
                  content: result.summary,
                  created_at: x.created_at,
                  streaming: false,
                  thoughtMs: result.thoughtMs,
                  versionId: result.versionId,
                  files: result.files,
                }
              : x
          )
        );
        setFiles(result.files);
        setActiveFiles(result.files);
      }
    } catch (e: any) {
      clearInterval(tickHandle);
      toast.error(e?.message ?? "Generation failed");
      setMessages((m) => m.filter((x) => x.id !== `${tempId}-a`));
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async (msg: Msg) => {
    if (!msg.versionId) return;
    const r: any = await restore({ data: { versionId: msg.versionId, projectId: id } });
    if (r?.files) {
      setFiles(r.files);
      setActiveFiles(r.files);
      setMessages((m) => [
        ...m,
        {
          id: r.messageId ?? `restore-${Date.now()}`,
          role: "assistant",
          content: `Restored: ${msg.content}`,
          created_at: new Date().toISOString(),
          versionId: r.versionId,
          files: r.files,
        },
      ]);
      toast.success("Restored");
    }
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { toast.error("Image too large (max 4MB)"); return; }
    const r = new FileReader();
    r.onload = () => setImageDataUrl(r.result as string);
    r.readAsDataURL(f);
  };

  const srcDoc = useMemo(
    () => buildPreviewSrcDoc(bundleCode, { visualEdit: editMode }),
    [bundleCode, editMode]
  );

  const currentFiles: ProjectFiles = (activeFiles && typeof activeFiles === "object" ? activeFiles : null) ?? (files && typeof files === "object" ? files : {});
  const filesList = useMemo(() => Object.entries(currentFiles).sort(([a], [b]) => a.localeCompare(b)), [currentFiles]);
  const [mobilePane, setMobilePane] = useState<"chat" | "preview">("chat");
  const [activeFile, setActiveFile] = useState<string>("App.tsx");
  useEffect(() => {
    if (filesList.length && !filesList.find(([n]) => n === activeFile)) setActiveFile(filesList[0][0]);
  }, [filesList, activeFile]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-gold/10 bg-noir/60 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-muted-foreground hover:text-gold"><ArrowLeft className="h-4 w-4" /></Link>
          <Logo className="hidden md:flex" />
          <div className="hidden h-6 w-px bg-gold/15 md:block" />
          <div className="font-display text-lg line-clamp-1">{title || "Loading…"}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode((v) => !v)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs ${editMode ? "border-gold bg-gold/10 text-gold" : "border-gold/15 text-muted-foreground hover:text-gold"}`}
            title="Click an element in the preview to edit it"
          >
            <MousePointerClick className="h-3 w-3" /> {editMode ? "Click an element…" : "Edit"}
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-gold/15 bg-onyx p-1">
            <button onClick={() => setView("preview")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${view === "preview" ? "bg-gradient-gold text-ink" : "text-muted-foreground"}`}>
              <Eye className="h-3 w-3" /> Preview
            </button>
            <button onClick={() => setView("code")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${view === "code" ? "bg-gradient-gold text-ink" : "text-muted-foreground"}`}>
              <Code2 className="h-3 w-3" /> Code
            </button>
          </div>
        </div>
      </header>

      <div className="mb-px flex shrink-0 border-b border-gold/10 bg-noir/40 lg:hidden">
        <button onClick={() => setMobilePane("chat")} className={`flex-1 px-4 py-2 text-xs uppercase tracking-widest ${mobilePane === "chat" ? "border-b-2 border-gold text-gold" : "text-muted-foreground"}`}>Chat</button>
        <button onClick={() => setMobilePane("preview")} className={`flex-1 px-4 py-2 text-xs uppercase tracking-widest ${mobilePane === "preview" ? "border-b-2 border-gold text-gold" : "text-muted-foreground"}`}>Preview</button>
      </div>
      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[420px_1fr]">
        <aside className={`${mobilePane === "chat" ? "flex" : "hidden"} h-full flex-col border-r border-gold/10 bg-noir/40 lg:flex`}>
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && !busy && (
              <div className="rounded-xl border border-dashed border-gold/20 p-6 text-center">
                <Sparkles className="mx-auto h-6 w-6 text-gold/60" />
                <p className="mt-3 text-sm text-muted-foreground">Tell Aurum what to build. Drop a screenshot for vision input.</p>
              </div>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="ml-6 rounded-xl bg-onyx p-3 text-sm">
                  <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">You</div>
                  {m.image_url && <img src={m.image_url} alt="" className="mb-2 max-h-40 rounded-md" />}
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              ) : (
                <AssistantCard
                  key={m.id}
                  msg={m}
                  onPreview={(f) => setActiveFiles(f)}
                  onRestore={() => onRestore(m)}
                />
              )
            )}
          </div>

          <div className="shrink-0 border-t border-gold/10 p-3">
            {selection && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 p-2 text-xs">
                <MousePointerClick className="h-3 w-3 text-gold" />
                <span className="flex-1 truncate text-gold">Editing &lt;{selection.tag}&gt;: "{selection.text.slice(0, 60)}"</span>
                <button onClick={() => setSelection(null)} className="text-muted-foreground hover:text-gold">×</button>
              </div>
            )}
            {imageDataUrl && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-gold/20 bg-onyx p-2">
                <img src={imageDataUrl} alt="" className="h-10 w-10 rounded object-cover" />
                <span className="flex-1 text-xs text-muted-foreground">Vision input ready</span>
                <button onClick={() => setImageDataUrl(null)} className="text-xs text-muted-foreground hover:text-gold">remove</button>
              </div>
            )}
            <div className="flex items-end gap-2 rounded-xl border border-gold/20 bg-onyx p-2">
              <label className="cursor-pointer rounded-md p-2 text-muted-foreground hover:bg-gold/5 hover:text-gold">
                <ImagePlus className="h-4 w-4" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(undefined, imageDataUrl); } }}
                placeholder={selection ? "Tell Aurum how to change this element…" : "Add a section… change the header… make it cinematic…"}
                rows={2}
                className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
              />
              <Button onClick={() => send(undefined, imageDataUrl)} disabled={busy || !input.trim()} size="sm" className="bg-gradient-gold text-ink hover:opacity-90">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
              <span className="flex items-center gap-1"><Coins className="h-3 w-3" />1 credit per generation</span>
              <Link to="/pricing" className="hover:text-gold">Get more →</Link>
            </div>
          </div>
        </aside>

        <section className="relative bg-noir">
          {view === "preview" ? (
            <div className="relative h-full w-full">
              {bundling && (
                <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-md bg-onyx/90 px-3 py-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Bundling…
                </div>
              )}
              {bundleErrors.length > 0 && !bundling && (
                <div className="absolute inset-x-3 top-3 z-10 max-h-40 overflow-auto rounded-md border border-red-500/40 bg-red-950/90 p-3 font-mono text-xs text-red-200">
                  {bundleErrors.join("\n")}
                </div>
              )}
              <iframe
                srcDoc={srcDoc}
                title="preview"
                className="h-full w-full border-0 bg-white"
                sandbox="allow-scripts allow-forms allow-popups allow-modals"
                referrerPolicy="no-referrer"
                allow="clipboard-write"
              />
            </div>
          ) : (
            <div className="grid h-full grid-cols-[200px_1fr] overflow-hidden">
              <div className="overflow-y-auto border-r border-gold/10 bg-onyx/60 p-2">
                {filesList.map(([name]) => (
                  <button
                    key={name}
                    onClick={() => setActiveFile(name)}
                    className={`block w-full truncate rounded px-2 py-1 text-left text-xs ${activeFile === name ? "bg-gold/15 text-gold" : "text-muted-foreground hover:text-gold"}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <pre className="h-full overflow-auto bg-onyx p-6 text-xs text-gold-soft"><code>{(activeFiles ?? files)[activeFile] ?? "// no file"}</code></pre>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AssistantCard({ msg, onPreview, onRestore }: { msg: Msg; onPreview: (f: ProjectFiles) => void; onRestore: () => void }) {
  const [tab, setTab] = useState<"summary" | "details">("summary");
  const seconds = Math.max(0, Math.round((msg.thoughtMs ?? 0) / 100) / 10);
  const fileCount = msg.files ? Object.keys(msg.files).length : 0;
  return (
    <div className="mr-6 rounded-xl border border-gold/15 bg-gold/[0.04]">
      <div className="flex items-center gap-2 border-b border-gold/10 px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        <Sparkles className="h-3 w-3 text-gold" />
        {msg.streaming ? (
          <span className="text-gold">Thinking… {seconds.toFixed(1)}s</span>
        ) : msg.thoughtMs ? (
          <span>Thought for {seconds.toFixed(1)}s</span>
        ) : (
          <span>Aurum</span>
        )}
      </div>
      <div className="p-3 text-sm">
        {msg.streaming && !msg.content ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Forging your app…</div>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none [&_a]:text-gold">
            <ReactMarkdown>{msg.content || "Updated."}</ReactMarkdown>
          </div>
        )}
      </div>
      {msg.files && fileCount > 0 && (
        <>
          <div className="flex items-center gap-1 border-t border-gold/10 px-2 py-1.5">
            <button onClick={() => { setTab("summary"); onPreview(msg.files!); }} className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${tab === "summary" ? "bg-gold/15 text-gold" : "text-muted-foreground hover:text-gold"}`}>
              <Eye className="h-3 w-3" /> Preview
            </button>
            <button onClick={() => setTab("details")} className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${tab === "details" ? "bg-gold/15 text-gold" : "text-muted-foreground hover:text-gold"}`}>
              <ChevronDown className="h-3 w-3" /> Details ({fileCount} {fileCount === 1 ? "file" : "files"})
            </button>
            {msg.versionId && (
              <button onClick={onRestore} className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-gold" title="Restore this version">
                <RotateCcw className="h-3 w-3" /> Restore
              </button>
            )}
          </div>
          {tab === "details" && (
            <div className="border-t border-gold/10 px-3 py-2 text-[11px] text-muted-foreground">
              {Object.keys(msg.files).map((f) => (<div key={f} className="font-mono">• {f}</div>))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
