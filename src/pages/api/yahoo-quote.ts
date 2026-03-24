/**
 * /api/yahoo-quote
 * Server-side proxy for Yahoo Finance data.
 * Avoids CORS issues — client calls this endpoint, not Yahoo directly.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "../../lib/auth/apiAuth";
import { fetchYahooQuotes } from "../../lib/market/yahooFetcher";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  // Accept ?symbols=AAPL,TSLA,TD.TO  OR  ?symbol=AAPL
  const raw     = (req.query.symbols || req.query.symbol || "") as string;
  const symbols = raw.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);

  if (!symbols.length) {
    return res.status(400).json({ error: "symbols required. e.g. ?symbols=AAPL,TSLA" });
  }

  try {
    const quotes = await fetchYahooQuotes(symbols);
    res.status(200).json({ quotes, count: Object.keys(quotes).length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}