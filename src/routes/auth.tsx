import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — Aurum.dev" }] }),
});

type Step = "form" | "otp";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("We sent a 6-digit code to your email.");
        setStep("otp");
        setResendIn(45);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email, token: otp, type: "email",
      });
      if (error) throw error;
      toast.success("Email verified. Welcome to Aurum.");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (resendIn > 0) return;
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) toast.error(error.message);
    else { toast.success("New code sent."); setResendIn(45); }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/dashboard`,
    });
    if (result.error) {
      toast.error("Google sign in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="grain relative flex min-h-screen items-center justify-center px-6 py-10">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-[var(--gold)]/15 blur-[140px]" />

      <Link to="/" className="absolute left-6 top-6 z-20 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="glass rounded-2xl p-8 shadow-deep">
          {step === "otp" ? (
            <>
              <div className="flex justify-center">
                <div className="rounded-full border border-gold/30 bg-gold/10 p-3">
                  <Mail className="h-6 w-6 text-gold" />
                </div>
              </div>
              <h1 className="mt-4 text-center font-display text-3xl">Verify your email</h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Enter the 6-digit code we sent to <span className="text-gold">{email}</span>
              </p>

              <div className="mt-8 flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    {[0,1,2,3,4,5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="h-12 w-12 border-gold/30 text-lg" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                onClick={verifyOtp}
                disabled={loading || otp.length !== 6}
                className="mt-8 w-full bg-gradient-gold text-noir hover:opacity-90 shadow-gold"
              >
                {loading ? "Verifying…" : "Verify & continue"}
              </Button>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                Didn't get it?{" "}
                <button
                  onClick={resend}
                  disabled={resendIn > 0}
                  className="text-gold hover:underline disabled:text-muted-foreground/50 disabled:no-underline"
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </button>
              </div>

              <button
                onClick={() => { setStep("form"); setOtp(""); }}
                className="mt-4 w-full text-center text-xs uppercase tracking-widest text-muted-foreground hover:text-gold"
              >
                Use a different email
              </button>
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl">
                {mode === "signup" ? "Begin the craft" : "Welcome back"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signup" ? "5 free credits land in your account today." : "Pick up where you left off."}
              </p>

              <Button
                onClick={handleGoogle}
                disabled={loading}
                variant="outline"
                className="mt-6 w-full border-gold/30 bg-transparent hover:bg-gold/5"
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"/></svg>
                Continue with Google
              </Button>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-gold/15" />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">or email</span>
                <div className="h-px flex-1 bg-gold/15" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 bg-noir/40" placeholder="Jane Doe" />
                  </div>
                )}
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 bg-noir/40" placeholder="you@example.com" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <Link to="/forgot-password" className="text-xs text-gold hover:underline">Forgot?</Link>
                    )}
                  </div>
                  <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 bg-noir/40" />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-gradient-gold text-noir hover:opacity-90 shadow-gold">
                  {loading ? "..." : mode === "signup" ? "Send verification code" : "Sign in"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signup" ? "Already have an account? " : "New here? "}
                <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="text-gold hover:underline">
                  {mode === "signup" ? "Sign in" : "Create one"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
