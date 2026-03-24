import type { NextApiRequest, NextApiResponse } from "next";
import { runMarketWorker } from "../../lib/market/marketWorker";
import { requireAuth } from "../../lib/auth/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const symbol = req.query.symbol as string;
  await runMarketWorker(symbol);
  res.status(200).json({ message: "worker executed", symbol });
}
