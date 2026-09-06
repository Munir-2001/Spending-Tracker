import { createClient } from "@/lib/supabase/server";
import { createPortal } from "@/server/billing";

/** `POST /api/billing/portal` → { url } to the Stripe Billing Portal. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = await createPortal(user.id);
  if (!url) {
    return Response.json({ error: "No subscription found" }, { status: 503 });
  }
  return Response.json({ url });
}
