import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/pricing")({
  component: Pricing,
  head: () => ({ meta: [{ title: "Pricing — Aurum.dev" }] }),
});

const packs = [
  { name: "Brass", credits: 50, price: 9, perks: ["50 premium credits", "Never expire", "All AI features"] },
  { name: "Gold", credits: 200, price: 29, popular: true, perks: ["200 premium credits", "Never expire", "Priority generation", "Advanced models"] },
  { name: "Platinum", credits: 1000, price: 99, perks: ["1,000 premium credits", "Never expire", "Top priority", "All models", "Early features"] },
];

function Pricing() {
  const { user } = useAuth();
  const buy = (pack: string) => {
    if (!user) { window.location.href = "/auth"; return; }
    toast.info("Stripe checkout connecting soon — your purchase will sync to your account.");
  };
  return (
    <div className="grain relative min-h-screen">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[1000px] -translate-x-1/2 rounded-full bg-[var(--gold)]/15 blur-[140px]" />
      <SiteNav />
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-12 text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-gold">Pricing</div>
        <h1 className="mt-4 font-display text-6xl md:text-7xl">Pay only for <span className="text-gradient-gold italic">premium gold.</span></h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Every account gets <span className="text-gold">5 free credits a day, forever.</span> Unlock more capacity with a one-time pack — no subscription, no expiry.
        </p>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {packs.map((p) => (
            <div key={p.name} className={`relative rounded-2xl border p-8 text-left transition-all hover:shadow-gold ${p.popular ? "border-gold/60 bg-gradient-to-br from-gold/10 to-transparent shadow-gold" : "border-gold/15 bg-card"}`}>
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-gold px-4 py-1 text-[10px] uppercase tracking-widest text-ink">
                  Most chosen
                </div>
              )}
              <Sparkles className="h-5 w-5 text-gold" />
              <h3 className="mt-4 font-display text-3xl">{p.name}</h3>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-5xl text-gradient-gold">${p.price}</span>
                <span className="text-sm text-muted-foreground">one-time</span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{p.credits} premium credits</div>
              <ul className="mt-6 space-y-3 text-sm">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
              <Button onClick={() => buy(p.name)} className={`mt-8 w-full ${p.popular ? "bg-gradient-gold text-ink hover:opacity-90 shadow-gold" : "bg-onyx hover:bg-gold/10 border border-gold/20"}`}>
                Get {p.name}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-gold/15 bg-onyx/60 p-8 text-center">
          <h3 className="font-display text-2xl">Free, every single day.</h3>
          <p className="mt-2 text-muted-foreground">5 credits land in your account at midnight UTC. Use them or lose them.</p>
          <Button asChild variant="link" className="mt-2 text-gold">
            <Link to="/auth">Start free →</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
