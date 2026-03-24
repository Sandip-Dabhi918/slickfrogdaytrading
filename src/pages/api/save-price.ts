import type { NextApiRequest, NextApiResponse } from "next";
import { savePrice } from "../../lib/db/priceRepository";
import { requireAuth } from "../../lib/auth/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    await savePrice(req.body);
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
