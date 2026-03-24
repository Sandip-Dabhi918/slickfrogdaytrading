/**
 * /api/search-stock
 * Searches Finnhub symbol lookup for US + Canadian (TSX) stocks.
 * Used by the "Add any stock" flow in ProfileManagerCard.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { requireAuth } from "../../lib/auth/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const q     = ((req.query.q as string) || "").trim();
  const upper = q.toUpperCase();
  if (!q) return res.status(400).json({ error: "q required" });

  const token = process.env.MARKET_API_KEY;

  try {
    // Search US and Canadian exchanges simultaneously
    const [usRes, cxRes] = await Promise.allSettled([
      axios.get(`https://finnhub.io/api/v1/search?q=${upper}&token=${token}`),
      // Also search with .TO suffix for Canadian stocks
      axios.get(`https://finnhub.io/api/v1/search?q=${upper}.TO&token=${token}`),
    ]);

    const usResults = usRes.status === "fulfilled"
      ? (usRes.value.data.result || [])
          .filter((r: any) =>
            r.type === "Common Stock" &&
            r.symbol &&
            !r.symbol.includes(".") // US stocks have no dot
          )
      : [];

    const cxResults = cxRes.status === "fulfilled"
      ? (cxRes.value.data.result || [])
          .filter((r: any) =>
            r.type === "Common Stock" &&
            r.symbol &&
            r.symbol.endsWith(".TO") // Canadian TSX stocks
          )
      : [];

    // Merge and dedupe — US first, then Canadian
    const allResults = [
      ...usResults.slice(0, 5),
      ...cxResults.slice(0, 3),
    ]
      .slice(0, 8)
      .map((r: any) => ({
        symbol:      r.symbol,
        description: r.description,
        type:        r.type,
        exchange:    r.symbol.endsWith(".TO") ? "TSX" : "US",
      }));

    // Fetch live quote for exact match
    let quote = null;
    const exact = allResults.find(
      r => r.symbol === upper || r.symbol === `${upper}.TO`
    );
    if (exact) {
      try {
        const qr = await axios.get(
          `https://finnhub.io/api/v1/quote?symbol=${exact.symbol}&token=${token}`
        );
        if (qr.data.c > 0) {
          quote = {
            price:     qr.data.c,
            change:    qr.data.d,
            changePct: qr.data.dp,
            symbol:    exact.symbol,
            exchange:  exact.exchange,
          };
        }
      } catch {}
    }

    res.status(200).json({ results: allResults, quote });
  } catch (err: any) {
    res.status(200).json({ results: [], quote: null, error: err.message });
  }
}