import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../lib/db/client";
import { requireAuth } from "../../lib/auth/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const symbol = req.query.symbol as string;

  const { data: prices, error } = await supabase
    .from("price_history")
    .select("*")
    .eq("symbol", symbol)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(prices || []);
}
