/**
 * GET /api/debug
 * Diagnostic endpoint — auth protected, for developers only.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "../../lib/auth/apiAuth";
import axios from "axios";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const results: any = {
    time: new Date().toISOString(),
    user: user.email,
    env: {
      MARKET_API_KEY:               process.env.MARKET_API_KEY              ? "✅ set" : "❌ MISSING",
      TWELVE_DATA_API_KEY:          process.env.TWELVE_DATA_API_KEY         ? "✅ set" : "⚠️ not set (TSX REST only)",
      NEXT_PUBLIC_SUPABASE_URL:     process.env.NEXT_PUBLIC_SUPABASE_URL    ? "✅ set" : "❌ MISSING",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ set" : "❌ MISSING",
      ANTHROPIC_API_KEY:            process.env.ANTHROPIC_API_KEY           ? "✅ set" : "⚠️ not set (AI disabled)",
      MARKET_PROVIDER:              process.env.MARKET_PROVIDER             || "hybrid (default)",
    },
  };

  try {
    const r = await axios.get(
      `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${process.env.MARKET_API_KEY}`,
      { timeout: 5000 }
    );
    results.finnhub = r.data?.c
      ? `✅ AAPL = $${r.data.c}`
      : `⚠️ price=0 — market may be closed`;
  } catch (e: any) {
    results.finnhub = `❌ ${e.message}`;
  }

  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: profiles, error: pe } = await sb.from("stock_profiles").select("ticker").limit(10);
    if (pe) throw pe;
    results.supabase_profiles = profiles?.length
      ? `✅ ${profiles.length} profiles: ${profiles.map((p: any) => p.ticker).join(", ")}`
      : "⚠️ No profiles — add stocks in Settings";

    const { count: priceCount } = await sb.from("price_history").select("*", { count: "exact", head: true });
    results.supabase_prices = `✅ ${priceCount ?? 0} price rows`;

    const { count: sigCount } = await sb.from("signals").select("*", { count: "exact", head: true });
    results.supabase_signals = `✅ ${sigCount ?? 0} signal rows`;

    const { count: snapCount } = await sb.from("session_snapshots").select("*", { count: "exact", head: true });
    results.supabase_snapshots = `✅ ${snapCount ?? 0} snapshot rows`;
  } catch (e: any) {
    results.supabase = `❌ ${e.message}`;
  }

  res.status(200).json(results);
}