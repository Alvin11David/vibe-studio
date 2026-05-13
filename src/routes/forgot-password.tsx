import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
  head: () => ({ meta: [{ title: "Reset password — Aurum.dev" }] }),
});

type Step = "email" | "verify";

function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      toast.success("If that account exists, a 6-digit code is on its way.");
      setStep("verify");
      setResendIn(45);
    } catch (err: any) {
      toast.error(err.message ?? "Could not send code");
    } finally {
      setLoading(false);
    }
  };

  const verifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { toast.error("Enter the 6-digit code"); return; }
    if (newPassword.length < 6) { toast.error("Password must be 6+ characters"); return; }
    setLoading(true);
    try {
      const { error: vErr } = await supabase.auth.verifyOtp({
        email, token: otp, type: "recovery",
      });
      if (vErr) throw vErr;
      const { error: uErr } = await supabase.auth.updateUser({ password: newPassword });
      if (uErr) throw uErr;
      toast.success("Password updated. Signed in.");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grain relative flex min-h-screen items-center justify-center px-6 py-10">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-[var(--gold)]/15 blur-[140px]" />

      <Link to="/auth" className="absolute left-6 top-6 z-20 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="glass rounded-2xl p-8 shadow-deep">
          {step === "email" ? (
            <>
              <div className="flex justify-center">
                <div className="rounded-full border border-gold/30 bg-gold/10 p-3">
                  <KeyRound className="h-6 w-6 text-gold" />
                </div>
              </div>
              <h1 className="mt-4 text-center font-display text-3xl">Forgot password</h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                We'll email you a 6-digit code to reset it.
              </p>

              <form onSubmit={sendCode} className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 bg-noir/40" placeholder="you@example.com" />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-gradient-gold text-noir hover:opacity-90 shadow-gold">
                  {loading ? "Sending…" : "Send reset code"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="flex justify-center">
                <div className="rounded-full border border-gold/30 bg-gold/10 p-3">
                  <Mail className="h-6 w-6 text-gold" />
                </div>
              </div>
              <h1 className="mt-4 text-center font-display text-3xl">Enter the code</h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Sent to <span className="text-gold">{email}</span>
              </p>

              <form onSubmit={verifyAndReset} className="mt-6 space-y-5">
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      {[0,1,2,3,4,5].map((i) => (
                        <InputOTPSlot key={i} index={i} className="h-12 w-12 border-gold/30 text-lg" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div>
                  <Label htmlFor="newPassword">New password</Label>
                  <Input id="newPassword" type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1.5 bg-noir/40" placeholder="At least 6 characters" />
                </div>

                <Button type="submit" disabled={loading || otp.length !== 6} className="w-full bg-gradient-gold text-noir hover:opacity-90 shadow-gold">
                  {loading ? "Updating…" : "Reset password"}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                Didn't get it?{" "}
                <button
                  onClick={() => sendCode()}
                  disabled={resendIn > 0}
                  className="text-gold hover:underline disabled:text-muted-foreground/50 disabled:no-underline"
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
