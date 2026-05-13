import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Sparkles, LogOut, Coins, History } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [credits, setCredits] = useState<{ free: number; paid: number } | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("user_credits").select("free_credits,paid_credits").maybeSingle();
      if (data) setCredits({ free: data.free_credits, paid: data.paid_credits });
    };
    load();
    const ch = supabase.channel("credits").on("postgres_changes",
      { event: "*", schema: "public", table: "user_credits", filter: `user_id=eq.${user.id}` },
      (p: any) => setCredits({ free: p.new.free_credits, paid: p.new.paid_credits })
    ).subscribe();
    return () => { ch.unsubscribe(); };
  }, [user]);

  if (loading || !user) {
    return (
      <div className="grain flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="grain relative flex min-h-screen">
      <aside className="sticky top-0 z-20 hidden h-screen w-64 shrink-0 border-r border-gold/10 bg-noir/60 p-6 backdrop-blur md:flex md:flex-col">
        <Logo />
        <nav className="mt-10 space-y-1 text-sm">
          <Link to="/dashboard" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-gold/5 hover:text-gold [&.active]:bg-gold/10 [&.active]:text-gold" activeProps={{ className: "active" }}>
            <LayoutDashboard className="h-4 w-4" /> Projects
          </Link>
          <Link to="/credits" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-gold/5 hover:text-gold [&.active]:bg-gold/10 [&.active]:text-gold" activeProps={{ className: "active" }}>
            <History className="h-4 w-4" /> Credit history
          </Link>
          <Link to="/pricing" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-gold/5 hover:text-gold">
            <Sparkles className="h-4 w-4" /> Get credits
          </Link>
        </nav>
        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-gold/15 bg-onyx/60 p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Credits</div>
            <div className="mt-2 flex items-baseline gap-1">
              <Coins className="h-4 w-4 text-gold" />
              <span className="font-display text-2xl text-gradient-gold">{(credits?.free ?? 0) + (credits?.paid ?? 0)}</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {credits?.free ?? 0} free · {credits?.paid ?? 0} premium
            </div>
            <Button asChild size="sm" className="mt-3 w-full bg-gradient-gold text-ink hover:opacity-90">
              <Link to="/pricing">Upgrade</Link>
            </Button>
          </div>
          <Button onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/" }))} variant="ghost" className="w-full justify-start text-muted-foreground hover:text-gold">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
