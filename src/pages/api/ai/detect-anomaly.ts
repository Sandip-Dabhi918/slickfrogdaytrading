import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../../lib/db/client";
import { requireAuth } from "../../../lib/auth/apiAuth";

export interface AnomalyResult {
  hasAnomalies: boolean;
  anomalies: Array<{
    metric:   string;
    current:  number;
    baseline: number;
    ratio:    number;
    severity: "LOW" | "MEDIUM" | "HIGH";
  }>;
  summary: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const user = await requireAuth(req, res);
  if (!user) return;

  const { symbol, currentSpread, currentVolume, currentVelocity } = req.body;

  try {
    // Pull last 200 snapshots for this symbol scoped to this user
    // Also include unscoped (user_id IS NULL) server-side snapshots as baseline
    const { data: snapshots, error } = await supabase
      .from("session_snapshots")
      .select("spread, volume, velocity, snapshot_at")
      .eq("symbol", symbol)
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order("snapshot_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    if (!snapshots || snapshots.length < 10) {
      return res.status(200).json({
        hasAnomalies: false,
        anomalies: [],
        summary: `Building baseline — ${snapshots?.length ?? 0}/10 snapshots collected. Anomaly detection activates after 10 data points.`,
      });
    }

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const spreads    = snapshots.map(s => Number(s.spread   ?? 0)).filter(v => v > 0);
    const volumes    = snapshots.map(s => Number(s.volume   ?? 0)).filter(v => v > 0);
    const velocities = snapshots.map(s => Math.abs(Number(s.velocity ?? 0)));

    const metrics = [
      { name: "Spread",   current: Number(currentSpread   ?? 0), baseline: avg(spreads)    },
      { name: "Volume",   current: Number(currentVolume   ?? 0), baseline: avg(volumes)    },
      { name: "Velocity", current: Math.abs(Number(currentVelocity ?? 0)), baseline: avg(velocities) },
    ];

    const anomalies = metrics
      .filter(m => m.baseline > 0 && m.current > 0)
      .map(m => {
        const ratio    = m.current / m.baseline;
        const severity: "LOW" | "MEDIUM" | "HIGH" =
          ratio > 3 || ratio < 0.2 ? "HIGH" :
          ratio > 2 || ratio < 0.4 ? "MEDIUM" : "LOW";
        return { metric: m.name, current: m.current, baseline: m.baseline, ratio, severity };
      })
      .filter(a => a.ratio > 1.5 || a.ratio < 0.5);

    let summary = `All metrics within normal range. (Baseline: ${snapshots.length} snapshots)`;

    if (anomalies.length > 0) {
      const anomalyDesc = anomalies
        .map(a =>
          `${a.metric} is ${a.ratio.toFixed(1)}x its baseline ` +
          `(current: ${a.current.toFixed(4)}, avg: ${a.baseline.toFixed(4)})`
        )
        .join("; ");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         process.env.ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model:      "claude-opus-4-6",
          max_tokens: 120,
          messages: [{
            role:    "user",
            content: `${symbol} is showing anomalous behavior: ${anomalyDesc}. Write one concise sentence flagging this as unusual and noting what it might indicate for a momentum fade trader. Be direct.`,
          }],
        }),
      });

      const data = await response.json();
      summary = data.content?.[0]?.text || anomalyDesc;
    }

    res.status(200).json({
      hasAnomalies: anomalies.length > 0,
      anomalies,
      summary,
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}