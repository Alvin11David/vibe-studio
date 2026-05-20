import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Coins, TrendingUp, TrendingDown, Sparkles, Calendar, ShoppingBag, Zap } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useServerFn } from "@tanstack/react-start";
import { topUpCredits } from "@/lib/credits.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/credits")({
  component: CreditsPage,
  head: () => ({ meta: [{ title: "Credit history — Aurum.dev" }] }),
});

interface Tx {
  id: string;
  amount: number;
  kind: string;
  description: string | null;
  created_at: string;
}

const KIND_META: Record<string, { label: string; icon: typeof Coins; tone: string }> = {
  daily_grant:   { label: "Daily grant", icon: Calendar, tone: "text-gold" },
  purchase:      { label: "Purchase",    icon: ShoppingBag, tone: "text-gold-soft" },
  ai_generation: { label: "Generation",  icon: Zap, tone: "text-muted-foreground" },
  generation:    { label: "Generation",  icon: Zap, tone: "text-muted-foreground" },
  refund:        { label: "Refund",      icon: TrendingUp, tone: "text-gold" },
};

function metaFor(kind: string) {
  return KIND_META[kind] ?? { label: kind.replace(/_/g, " "), icon: Coins, tone: "text-muted-foreground" };
}

function CreditsPage() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [credits, setCredits] = useState<{ free: number; paid: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "grants" | "purchases" | "spend">("all");

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: c }] = await Promise.all([
        supabase.from("credit_transactions").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("user_credits").select("free_credits,paid_credits").maybeSingle(),
      ]);
      setTxs(t ?? []);
      if (c) setCredits({ free: c.free_credits, paid: c.paid_credits });
      setLoading(false);
    })();
  }, []);

  const filtered = txs.filter((t) => {
    if (filter === "grants")    return t.kind === "daily_grant";
    if (filter === "purchases") return t.kind === "purchase";
    if (filter === "spend")     return t.amount < 0;
    return true;
  });

  const totals = txs.reduce(
    (acc, t) => {
      if (t.kind === "daily_grant") acc.granted += t.amount;
      else if (t.kind === "purchase") acc.purchased += t.amount;
      else if (t.amount < 0) acc.spent += Math.abs(t.amount);
      return acc;
    },
    { granted: 0, purchased: 0, spent: 0 },
  );

  // Group by date
  const groups = filtered.reduce<Record<string, Tx[]>>((acc, t) => {
    const k = format(new Date(t.created_at), "yyyy-MM-dd");
    (acc[k] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl px-8 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-gold">Ledger</div>
          <h1 className="mt-2 font-display text-5xl">Credit history</h1>
          <p className="mt-2 text-muted-foreground">Every grant, purchase, and generation — accounted for.</p>
        </div>
        <Button asChild className="bg-gradient-gold text-ink hover:opacity-90 shadow-gold">
          <Link to="/pricing"><Sparkles className="mr-2 h-4 w-4" /> Buy credits</Link>
        </Button>
      </div>

      {/* Stat cards */}
      <div className="mt-10 grid gap-4 md:grid-cols-4">
        <StatCard
          label="Available"
          value={(credits?.free ?? 0) + (credits?.paid ?? 0)}
          sub={`${credits?.free ?? 0} free · ${credits?.paid ?? 0} premium`}
          icon={Coins}
          highlight
        />
        <StatCard label="Granted (lifetime)"   value={totals.granted}   sub="Daily free credits" icon={Calendar} />
        <StatCard label="Purchased (lifetime)" value={totals.purchased} sub="Premium top-ups"    icon={ShoppingBag} />
        <StatCard label="Spent (lifetime)"     value={totals.spent}     sub="On generations"     icon={TrendingDown} />
      </div>

      {/* Filters */}
      <div className="mt-10 flex flex-wrap items-center gap-2">
        {(["all", "grants", "purchases", "spend"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-widest transition-colors ${
              filter === f
                ? "border-gold bg-gold/10 text-gold"
                : "border-border text-muted-foreground hover:border-gold/40 hover:text-gold"
            }`}
          >
            {f === "all" ? "All activity" : f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="mt-6">
        {loading ? (
          <div className="space-y-2">{[0,1,2,3,4].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-card/60" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gold/20 p-12 text-center">
            <Coins className="mx-auto h-10 w-10 text-gold/40" />
            <p className="mt-4 text-muted-foreground">No transactions to show.</p>
            <Button asChild className="mt-6 bg-gradient-gold text-ink hover:opacity-90"><Link to="/pricing">Get started</Link></Button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groups).map(([day, items]) => (
              <div key={day}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h3 className="font-display text-lg">{format(new Date(day), "EEEE, MMM d, yyyy")}</h3>
                  <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{items.length} entr{items.length === 1 ? "y" : "ies"}</span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
                  {items.map((t, i) => {
                    const m = metaFor(t.kind);
                    const Icon = m.icon;
                    const positive = t.amount > 0;
                    return (
                      <div key={t.id} className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-border" : ""}`}>
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/20 bg-gold/5 ${m.tone}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{m.label}</span>
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">{t.kind}</span>
                          </div>
                          {t.description && <div className="mt-0.5 truncate text-sm text-muted-foreground">{t.description}</div>}
                        </div>
                        <div className="hidden text-right text-xs text-muted-foreground sm:block">
                          <div>{format(new Date(t.created_at), "h:mm a")}</div>
                          <div className="opacity-70">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</div>
                        </div>
                        <div className={`w-20 text-right font-display text-xl ${positive ? "text-gold" : "text-foreground/80"}`}>
                          {positive ? "+" : ""}{t.amount}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, highlight }: { label: string; value: number; sub: string; icon: any; highlight?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 ${highlight ? "border-gold/40 bg-gradient-to-br from-gold/10 to-transparent shadow-gold" : "border-border bg-card/60"}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${highlight ? "text-gold" : "text-muted-foreground"}`} />
      </div>
      <div className={`mt-3 font-display text-4xl ${highlight ? "text-gradient-gold" : ""}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
