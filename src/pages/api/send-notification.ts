import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "../../lib/auth/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const user = await requireAuth(req, res);
  if (!user) return;

  const { symbol, direction, conviction, score, triggers, email, phone } = req.body;

  const subject = `${symbol} · ${direction === "SELL_FADE" ? "Sell Fade" : "Buy Exhaustion"} Alert`;
  const message = `${symbol} ${direction === "SELL_FADE" ? "Sell Fade" : "Buy Exhaustion"} — ${conviction} (Score ${score}/3). Triggers: ${(triggers || []).join(", ")}`;

  const results: Record<string, any> = {};

  // ── Email via Resend ────────────────────────────────────────────────────────
  if (email && process.env.RESEND_API_KEY) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:    process.env.RESEND_FROM_EMAIL || "alerts@momentumfade.com",
          to:      [email],
          subject,
          text:    message,
        }),
      });
      results.email = r.ok ? "sent" : `failed (${r.status})`;
    } catch (e: any) {
      results.email = `error: ${e.message}`;
    }
  }

  res.status(200).json({ ok: true, results });
}
