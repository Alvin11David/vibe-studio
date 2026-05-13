import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Image as ImageIcon, Code2, Zap, Lock, Globe, MessageSquare, Cpu } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Aurum.dev — Build apps by talking. Pure gold." },
      { name: "description", content: "The vibe-coding platform with a Noir & Gold soul. Describe what you want, watch it build itself live. 5 free credits daily." },
    ],
  }),
});

function Landing() {
  return (
    <div className="grain relative min-h-screen overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[1200px] -translate-x-1/2 rounded-full bg-[var(--gold)]/15 blur-[140px]" />
      <div className="pointer-events-none absolute top-[600px] -left-40 h-[400px] w-[400px] rounded-full bg-[var(--gold-deep)]/20 blur-[120px]" />

      <SiteNav />

      {/* HERO */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-32 pt-20 text-center">
        <div className="animate-float-up inline-flex items-center gap-2 rounded-full border border-gold/30 bg-noir/40 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-gold backdrop-blur">
          <Sparkles className="h-3 w-3" />
          The vibe-coding renaissance
        </div>
        <h1 className="animate-float-up mx-auto mt-8 max-w-5xl text-6xl font-medium leading-[1.05] md:text-8xl" style={{ animationDelay: "0.1s" }}>
          Build software <br />
          <span className="text-gradient-gold animate-shimmer italic">in pure gold.</span>
        </h1>
        <p className="animate-float-up mx-auto mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl" style={{ animationDelay: "0.2s" }}>
          Describe an idea. Drop a screenshot. Wave your hands.<br />
          Aurum translates intent into production-grade web apps — instantly.
        </p>

        <div className="animate-float-up mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row" style={{ animationDelay: "0.3s" }}>
          <Button asChild size="lg" className="group h-14 bg-gradient-gold px-8 text-base text-ink hover:opacity-90 shadow-gold glow-gold">
            <Link to="/auth">
              Start building free
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-14 border-gold/30 bg-transparent px-8 text-base hover:bg-gold/5">
            <Link to="/pricing">View pricing</Link>
          </Button>
        </div>

        <div className="animate-float-up mt-6 text-xs uppercase tracking-[0.25em] text-muted-foreground/70" style={{ animationDelay: "0.4s" }}>
          5 free credits — every single day · No card required
        </div>

        {/* Hero mockup */}
        <div className="animate-float-up relative mx-auto mt-20 max-w-5xl" style={{ animationDelay: "0.5s" }}>
          <div className="absolute -inset-1 rounded-2xl bg-gradient-gold opacity-30 blur-2xl" />
          <div className="glass relative rounded-2xl p-2 shadow-deep">
            <div className="rounded-xl bg-noir/80 p-1">
              <div className="flex items-center gap-1.5 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
                <div className="ml-3 flex-1 rounded-md bg-onyx px-3 py-1 text-left text-xs text-muted-foreground">aurum.dev / projects / luxury-storefront</div>
              </div>
              <div className="grid grid-cols-1 gap-1 lg:grid-cols-[320px_1fr]">
                <div className="space-y-3 rounded-lg bg-onyx/60 p-4 text-left">
                  <div className="text-[10px] uppercase tracking-widest text-gold">Chat</div>
                  <div className="rounded-lg bg-noir/60 p-3 text-sm">Build a luxury watch e-commerce homepage with parallax hero.</div>
                  <div className="rounded-lg bg-gold/10 p-3 text-sm border border-gold/20">✨ Generated 184 lines. Live preview ready.</div>
                  <div className="rounded-lg bg-noir/60 p-3 text-sm">Add a countdown to the next drop in the header.</div>
                </div>
                <div className="aspect-video rounded-lg bg-gradient-to-br from-gold-deep/30 via-noir to-noir relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="font-display text-5xl text-gradient-gold">PATEK · 2026</div>
                      <div className="mt-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">Live preview</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 py-32">
        <div className="text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-gold">The Atelier</div>
          <h2 className="mt-4 text-5xl md:text-6xl">Every move feels <span className="text-gradient-gold italic">deliberate.</span></h2>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-gold/20 bg-gold/10 md:grid-cols-3">
          {[
            { icon: MessageSquare, title: "Natural language", desc: "Describe an idea. The AI builds it. Iterate by chatting." },
            { icon: ImageIcon, title: "Vision input", desc: "Drop a screenshot, Figma export, or sketch. We see it." },
            { icon: Zap, title: "Real-time generation", desc: "Watch your UI come to life in a live iframe preview." },
            { icon: Code2, title: "Real, clean code", desc: "Not magic. Production HTML, CSS, and JavaScript you own." },
            { icon: Cpu, title: "Iterative refinement", desc: "Surgical edits — change a section without breaking the rest." },
            { icon: Globe, title: "One-click publish", desc: "Ship your work to a public URL the moment it’s ready." },
          ].map((f, i) => (
            <div key={i} className="group relative bg-noir p-8 transition-colors hover:bg-onyx">
              <f.icon className="h-6 w-6 text-gold transition-transform group-hover:scale-110" />
              <h3 className="mt-6 font-display text-2xl">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CREDITS BANNER */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-32">
        <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-onyx p-12 md:p-20 shadow-deep">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gradient-gold opacity-20 blur-3xl" />
          <div className="relative max-w-2xl">
            <div className="text-xs uppercase tracking-[0.3em] text-gold">The pact</div>
            <h2 className="mt-4 text-5xl md:text-6xl leading-tight">
              <span className="text-gradient-gold italic">Five</span> free credits.<br />
              Every dawn. Forever.
            </h2>
            <p className="mt-6 text-lg text-muted-foreground">
              No card. No catch. Burn through them generating ideas, then upgrade to a pack of premium credits whenever you need to ship.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gradient-gold text-ink hover:opacity-90 shadow-gold">
                <Link to="/auth">Claim daily credits <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-gold/30 bg-transparent">
                <Link to="/pricing">See premium packs</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-32">
        <div className="text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-gold">Workflow</div>
          <h2 className="mt-4 text-5xl md:text-6xl">From whisper <span className="text-gradient-gold italic">to ship.</span></h2>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {[
            { step: "01", title: "Speak the vision", desc: "Type, paste, drop. Whatever shape your idea takes." },
            { step: "02", title: "Watch it forge", desc: "AI writes the code, the preview animates into existence." },
            { step: "03", title: "Refine in chat", desc: "Tweak with words. The whole app obeys." },
          ].map((s, i) => (
            <div key={i} className="relative rounded-2xl border border-gold/15 bg-card p-8 transition-all hover:border-gold/40 hover:shadow-gold">
              <div className="font-display text-7xl text-gradient-gold">{s.step}</div>
              <h3 className="mt-4 font-display text-2xl">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-32 text-center">
        <Lock className="mx-auto h-8 w-8 text-gold" />
        <h2 className="mt-6 text-5xl md:text-7xl leading-tight">
          The atelier <span className="text-gradient-gold italic">is open.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Stop describing software. Start producing it.
        </p>
        <Button asChild size="lg" className="mt-10 h-14 bg-gradient-gold px-10 text-base text-ink shadow-gold glow-gold hover:opacity-90">
          <Link to="/auth">Enter Aurum <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </section>

      <footer className="relative z-10 border-t border-gold/10 px-6 py-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-xs text-muted-foreground">
          <div>© 2026 Aurum.dev — Forged in pure intent.</div>
          <div className="flex gap-6"><Link to="/pricing" className="hover:text-gold">Pricing</Link><Link to="/auth" className="hover:text-gold">Sign in</Link></div>
        </div>
      </footer>
    </div>
  );
}
