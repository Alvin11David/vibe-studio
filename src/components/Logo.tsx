import { Link } from "@tanstack/react-router";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <div className="h-8 w-8 rounded-lg bg-gradient-gold animate-shimmer" />
        <div className="absolute inset-0 h-8 w-8 rounded-lg border border-gold/40" />
      </div>
      <span className="font-display text-xl tracking-tight">
        <span className="text-gradient-gold">Aurum</span>
        <span className="text-foreground/80">.dev</span>
      </span>
    </Link>
  );
}
