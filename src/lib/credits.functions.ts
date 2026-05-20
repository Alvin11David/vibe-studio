import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TopUpSchema = z.object({ amount: z.number().int().min(1).max(1000) });

export const topUpCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TopUpSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { amount } = data;

    // Ensure row exists
    await supabaseAdmin
      .from("user_credits")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

    const { data: current, error: readErr } = await supabaseAdmin
      .from("user_credits")
      .select("paid_credits")
      .eq("user_id", userId)
      .single();
    if (readErr) throw new Error(readErr.message);

    const newPaid = (current?.paid_credits ?? 0) + amount;
    const { error: updErr } = await supabaseAdmin
      .from("user_credits")
      .update({ paid_credits: newPaid, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin.from("credit_transactions").insert({
      user_id: userId,
      amount,
      kind: "purchase",
      description: `Manual top-up (+${amount} credits)`,
    });

    return { ok: true, paid_credits: newPaid };
  });
