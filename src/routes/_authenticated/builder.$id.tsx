import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateApp } from "@/lib/ai-builder.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Sparkles, ImagePlus, Loader2, Eye, Code2, Coins } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/_authenticated/builder/$id")({
  component: Builder,
  head: () => ({ meta: [{ title: "Builder — Aurum.dev" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ initial: typeof s.initial === "string" ? s.initial : undefined }),
});

interface Msg { id: string; role: string; content: string; image_url?: string | null; created_at: string; }

function Builder() {
  const { id } = useParams({ from: "/_authenticated/builder/$id" });
  const search = Route.useSearch();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [input, setInput] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"preview" | "code">("preview");
  const generate = useServerFn(generateApp);
  const sentInitial = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load project + messages
  useEffect(() => {
    (async () => {
      const [{ data: project }, { data: msgs }] = await Promise.all([
        supabase.from("projects").select("title,current_code").eq("id", id).maybeSingle(),
        supabase.from("messages").select("id,role,content,image_url,created_at").eq("project_id", id).order("created_at"),
      ]);
      if (project) { setTitle(project.title); setCode(project.current_code || ""); }
      if (msgs) setMessages(msgs as Msg[]);
    })();
  }, [id]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);

  const send = async (text?: string, image?: string | null) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setBusy(true);
    setInput("");
    setImageDataUrl(null);

    // Optimistic user message
    const tempId = `tmp-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, role: "user", content: message, image_url: image ?? null, created_at: new Date().toISOString() }]);

    try {
      const result: any = await generate({ data: { projectId: id, message, imageDataUrl: image ?? undefined } });
      if (result.error) {
        toast.error(result.message);
        if (result.error === "out_of_credits") {
          setMessages((m) => [...m, { id: `err-${Date.now()}`, role: "assistant", content: "You're out of credits. Visit /pricing to top up.", created_at: new Date().toISOString() }]);
        }
      } else {
        setMessages((m) => [...m, { id: `r-${Date.now()}`, role: "assistant", content: result.summary, created_at: new Date().toISOString() }]);
        if (result.html) setCode(result.html);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  // Auto-send initial prompt from dashboard
  useEffect(() => {
    if (search.initial && !sentInitial.current && title) {
      sentInitial.current = true;
      send(search.initial);
    }
  }, [search.initial, title]);

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { toast.error("Image too large (max 4MB)"); return; }
    const r = new FileReader();
    r.onload = () => setImageDataUrl(r.result as string);
    r.readAsDataURL(f);
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-gold/10 bg-noir/60 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-muted-foreground hover:text-gold"><ArrowLeft className="h-4 w-4" /></Link>
          <Logo className="hidden md:flex" />
          <div className="hidden h-6 w-px bg-gold/15 md:block" />
          <div className="font-display text-lg line-clamp-1">{title || "Loading…"}</div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-gold/15 bg-onyx p-1">
          <button onClick={() => setView("preview")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${view === "preview" ? "bg-gradient-gold text-noir" : "text-muted-foreground"}`}>
            <Eye className="h-3 w-3" /> Preview
          </button>
          <button onClick={() => setView("code")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${view === "code" ? "bg-gradient-gold text-noir" : "text-muted-foreground"}`}>
            <Code2 className="h-3 w-3" /> Code
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[400px_1fr]">
        {/* Chat */}
        <aside className="flex h-full flex-col border-r border-gold/10 bg-noir/40">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && !busy && (
              <div className="rounded-xl border border-dashed border-gold/20 p-6 text-center">
                <Sparkles className="mx-auto h-6 w-6 text-gold/60" />
                <p className="mt-3 text-sm text-muted-foreground">Tell Aurum what to build. Drop a screenshot for vision input.</p>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`rounded-xl p-3 text-sm ${m.role === "user" ? "ml-6 bg-onyx" : "mr-6 border border-gold/15 bg-gold/5"}`}>
                <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">{m.role === "user" ? "You" : "Aurum"}</div>
                {m.image_url && <img src={m.image_url} alt="" className="mb-2 max-h-40 rounded-md" />}
                <div className="whitespace-pre-wrap line-clamp-[12]">{m.content.replace(/```html[\s\S]*?```/gi, "").trim() || "✨ Updated."}</div>
              </div>
            ))}
            {busy && (
              <div className="mr-6 flex items-center gap-2 rounded-xl border border-gold/15 bg-gold/5 p-3 text-sm text-gold">
                <Loader2 className="h-4 w-4 animate-spin" /> Forging your app…
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-gold/10 p-3">
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
                placeholder="Add a section… change the header… make it feel cinematic…"
                rows={2}
                className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
              />
              <Button onClick={() => send(undefined, imageDataUrl)} disabled={busy || !input.trim()} size="sm" className="bg-gradient-gold text-noir hover:opacity-90">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
              <span className="flex items-center gap-1"><Coins className="h-3 w-3" />1 credit per generation</span>
              <Link to="/pricing" className="hover:text-gold">Get more →</Link>
            </div>
          </div>
        </aside>

        {/* Preview */}
        <section className="relative bg-noir">
          {view === "preview" ? (
            code ? (
              <iframe srcDoc={code} title="preview" className="h-full w-full border-0 bg-white" sandbox="allow-scripts allow-forms allow-popups allow-same-origin" />
            ) : (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <div className="font-display text-4xl text-gradient-gold">Empty canvas</div>
                  <p className="mt-3 text-muted-foreground">Send a prompt to summon your app.</p>
                </div>
              </div>
            )
          ) : (
            <pre className="h-full overflow-auto bg-onyx p-6 text-xs text-gold-soft"><code>{code || "// no code yet"}</code></pre>
          )}
        </section>
      </div>
    </div>
  );
}
