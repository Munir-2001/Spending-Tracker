import { createClient } from "@/lib/supabase/server";
import { createCheckout } from "@/server/billing";

/** `POST /api/billing/checkout` → { url } to Stripe Checkout. Node runtime. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { plan?: string };
  const plan = body.plan === "annual" ? "annual" : "trial";

  const url = await createCheckout({
    userId: user.id,
    email: user.email ?? undefined,
    plan,
  });
  if (!url) {
    return Response.json({ error: "Billing not configured" }, { status: 503 });
  }
  return Response.json({ url });
}
