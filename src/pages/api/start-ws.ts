import type { NextApiRequest, NextApiResponse } from "next";
import { startPolygonWS } from "@/src/lib/polygonWS";
import { startSimulator } from "@/src/lib/simulator";

let started = false;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!started) {
    startPolygonWS();   // Polygon (auth only)
    startSimulator();   // 🔥 fake real-time data
    started = true;
  }

  res.status(200).json({ status: "System running (simulated)" });
}