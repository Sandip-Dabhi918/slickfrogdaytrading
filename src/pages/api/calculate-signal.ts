import type { NextApiRequest, NextApiResponse } from "next";
import { calculateSignal } from "../../lib/market/signalEngine";
import { saveSignal } from "../../lib/db/signalRepository";
import { requireAuth } from "../../lib/auth/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const {
      symbol,
      currentPrice,
      previousPrice,
      prevVelocity = 0,
      bid,
      ask,
      prevSpread = null,
      hasNews    = false,
    } = req.body;

    const signal = calculateSignal(
      currentPrice,
      previousPrice,
      prevVelocity,
      bid,
      ask,
      undefined,
      undefined,
      symbol,
      5,
      prevSpread,
      hasNews,
    );

    await saveSignal({ ...signal, symbol }, user.id);
    res.status(200).json(signal);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}