import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "../../../lib/auth/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const user = await requireAuth(req, res);
  if (!user) return;

  const { symbol, velocity, acceleration, spread, spreadRate, divergence,
          score, strength, price, peerAvg, direction, news } = req.body;

  const noNews   = !news || news.length === 0;
  const newsSnip = noNews ? "No recent news found." :
    news.slice(0, 3).map((n: any) => `• ${n.headline} (${n.source})`).join("\n");

  const prompt = `You are a real-time trading signal analyst. Interpret the following signal state for ${symbol} and provide a 2-3 sentence plain-English assessment.

SIGNAL STATE:
- Symbol: ${symbol}
- Current Price: $${price?.toFixed(2) ?? "N/A"}
- Direction: ${direction} (${direction === "SELL_FADE" ? "upward momentum fading" : direction === "BUY_EXHAUSTION" ? "downward momentum exhausting" : "no clear direction"})
- Velocity: ${Number(velocity).toFixed(4)} (${Number(velocity) > 0 ? "rising" : "falling"})
- Acceleration: ${Number(acceleration).toFixed(4)} (${Number(acceleration) > 0 ? "speeding up" : "slowing down"})
- Spread: $${Number(spread).toFixed(4)} (rate of change: ${Number(spreadRate ?? 0).toFixed(5)})
- Peer Divergence: ${divergence != null ? (Number(divergence) > 0 ? "+" : "") + Number(divergence).toFixed(2) + "%" : "N/A"} vs peer average ${peerAvg != null ? (Number(peerAvg) > 0 ? "+" : "") + Number(peerAvg).toFixed(2) + "%" : ""}
- Signal Score: ${score}/3 (${strength})
- News: ${newsSnip}

Rules:
- Be direct and specific, use the actual numbers
- State clearly whether conditions favour acting, waiting, or ignoring
- If news is present, assess whether it explains the move
- Keep it to 2-3 sentences maximum
- Do not use bullet points, write in flowing prose`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "Signal interpretation unavailable.";
    res.status(200).json({ interpretation: text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
