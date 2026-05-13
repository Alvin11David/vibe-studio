import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "./ThemeToggle";

export function SiteNav() {
  const { user, loading } = useAuth();
  return (
    <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
      <Logo />
      <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
        <Link to="/" className="transition-colors hover:text-gold">Home</Link>
        <Link to="/pricing" className="transition-colors hover:text-gold">Pricing</Link>
        <a href="#features" className="transition-colors hover:text-gold">Features</a>
      </nav>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {!loading && user ? (
          <Button asChild variant="default" className="bg-gradient-gold text-ink hover:opacity-90 shadow-gold">
            <Link to="/dashboard">Dashboard</Link>
          </Button>
        ) : (
          <>
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild className="bg-gradient-gold text-ink hover:opacity-90 shadow-gold">
              <Link to="/auth">Start building</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
