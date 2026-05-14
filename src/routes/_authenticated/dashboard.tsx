import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Folder, ArrowRight, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { TEMPLATES, type Template } from "@/lib/templates";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — Aurum.dev" }] }),
});

interface Project {
  id: string; title: string; description: string | null; updated_at: string;
}

function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    supabase.from("projects").select("id,title,description,updated_at").order("updated_at", { ascending: false }).then(({ data }) => {
      setProjects(data ?? []);
      setLoading(false);
    });
  }, []);

  const create = async (overridePrompt?: string, titleOverride?: string) => {
    const p = (overridePrompt ?? prompt).trim();
    if (!p) { toast.error("Describe what you want to build"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase.from("projects").insert({
      user_id: u.user.id,
      title: (titleOverride ?? p).slice(0, 60),
      description: p,
    }).select("id").single();
    if (error || !data) { toast.error("Failed to create project"); return; }
    navigate({ to: "/builder/$id", params: { id: data.id }, search: { initial: p } as any });
  };

  const startFromTemplate = (t: Template) => create(t.prompt, t.title);

  return (
    <div className="mx-auto max-w-6xl px-8 py-12">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-gold">Atelier</div>
          <h1 className="mt-2 font-display text-5xl">Your projects</h1>
        </div>
      </div>

      {/* Quick start */}
      <div className="mt-10 rounded-2xl border border-gold/20 bg-gradient-to-br from-onyx to-noir p-8 shadow-deep">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
          <Sparkles className="h-3 w-3" /> Begin a new piece
        </div>
        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="A moody portfolio for an architect with parallax hero…"
            className="flex-1 rounded-xl border border-gold/20 bg-noir/60 px-5 py-4 text-base outline-none placeholder:text-muted-foreground/60 focus:border-gold/60"
          />
          <Button onClick={() => create()} size="lg" className="h-auto bg-gradient-gold px-6 text-ink shadow-gold hover:opacity-90">
            Build <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Templates */}
      <div className="mt-12">
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-gold"><Wand2 className="h-3 w-3" /> Templates</div>
            <h2 className="mt-2 font-display text-2xl">Start from a blueprint</h2>
          </div>
          <p className="hidden text-sm text-muted-foreground md:block">One click. One credit. Yours to remix.</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => startFromTemplate(t)}
                className="group relative overflow-hidden rounded-xl border border-gold/15 bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-gold"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10 text-gold transition-colors group-hover:bg-gold/20">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="mt-3 font-display text-base">{t.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.tagline}</p>
                <ArrowRight className="absolute right-4 top-4 h-4 w-4 text-gold opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Projects grid */}
      <div className="mt-12">
        <h2 className="font-display text-2xl text-muted-foreground">Recent</h2>
        {loading ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0,1,2].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-onyx/50" />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gold/20 p-12 text-center">
            <Folder className="mx-auto h-10 w-10 text-gold/40" />
            <p className="mt-4 text-muted-foreground">No projects yet. Build your first above.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} to="/builder/$id" params={{ id: p.id }} className="group relative overflow-hidden rounded-xl border border-gold/15 bg-card p-6 transition-all hover:border-gold/40 hover:shadow-gold">
                <div className="absolute right-4 top-4 opacity-0 transition-opacity group-hover:opacity-100">
                  <ArrowRight className="h-4 w-4 text-gold" />
                </div>
                <Folder className="h-5 w-5 text-gold/60" />
                <h3 className="mt-4 font-display text-xl line-clamp-1">{p.title}</h3>
                {p.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
                <div className="mt-4 text-[11px] uppercase tracking-widest text-muted-foreground/60">
                  {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
