import type { NextApiRequest, NextApiResponse } from "next";
import { runScanner } from "../../lib/market/scanner";
import { requireAuth } from "../../lib/auth/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const start = Date.now();
  const hasMarketKey = !!process.env.MARKET_API_KEY;
  const hasSupabase  = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!hasMarketKey) {
    return res.status(500).json({
      error: "MARKET_API_KEY is not set. Check your .env.local file.",
      hint:  "Rename .env to .env.local — Next.js API routes require .env.local for server secrets.",
    });
  }

  try {
    // Pass user.id so scanner can scope all DB writes to this user
    const result = await runScanner(user.id);
    res.status(200).json({
      ok:       true,
      scanned:  result.scanned,
      results:  result.results,
      errors:   result.errors,
      duration: `${Date.now() - start}ms`,
      time:     new Date().toISOString(),
      env:      { hasMarketKey, hasSupabase },
    });
  } catch (err: any) {
    res.status(500).json({
      error:    err.message,
      env:      { hasMarketKey, hasSupabase },
      duration: `${Date.now() - start}ms`,
    });
  }
}