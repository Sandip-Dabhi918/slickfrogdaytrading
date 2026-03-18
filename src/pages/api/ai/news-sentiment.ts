import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "../../../lib/auth/apiAuth";

export interface SentimentResult {
  headline:   string;
  sentiment:  "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  material:   boolean;
  assessment: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const user = await requireAuth(req, res);
  if (!user) return;

  const { symbol, headlines, direction } = req.body;
  if (!headlines?.length) return res.status(200).json({ results: [] });

  const headlineList = headlines
    .slice(0, 5)
    .map((h: any, i: number) => `${i + 1}. "${h.headline}" — ${h.source}`)
    .join("\n");

  const prompt = `Analyze these recent news headlines for ${symbol} and return a JSON array.

Current price action: ${direction === "SELL_FADE" ? "stock is rising but decelerating" : direction === "BUY_EXHAUSTION" ? "stock is falling but decelerating" : "neutral momentum"}.

Headlines:
${headlineList}

For each headline return a JSON object with:
- headline: the original headline text (shortened to 80 chars max)
- sentiment: "POSITIVE", "NEGATIVE", or "NEUTRAL"
- material: true if this news could meaningfully explain the current price move (earnings, M&A, guidance, regulatory), false if routine (analyst reiterations, minor mentions)
- assessment: one sentence explaining your reasoning

Return ONLY a valid JSON array, no markdown, no preamble.`;

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
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text  = data.content?.[0]?.text || "[]";
    const clean = text.replace(/```json|```/g, "").trim();
    const results: SentimentResult[] = JSON.parse(clean);
    res.status(200).json({ results });
  } catch {
    res.status(200).json({ results: [] });
  }
}
