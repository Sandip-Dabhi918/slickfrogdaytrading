import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../lib/db/client";
import { requireAuth } from "../../lib/auth/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .order("score", { ascending: false })
    .limit(10);

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data || []);
}
