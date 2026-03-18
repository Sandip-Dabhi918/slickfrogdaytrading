import type { NextApiRequest, NextApiResponse } from "next";
import { getSignals } from "../../lib/db/signalRepository";
import { requireAuth } from "../../lib/auth/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const signals = await getSignals();
    res.status(200).json(signals);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
