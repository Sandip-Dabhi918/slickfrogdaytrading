import { useCallback, useRef } from "react";

type AlertTone = "sell" | "buy" | "nudge";

export function useAlertSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = () => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return ctxRef.current;
  };

  const beep = useCallback((tone: AlertTone) => {
    try {
      const ctx  = getCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      // sell = descending two-tone, buy = ascending two-tone, nudge = single
      const configs: Record<AlertTone, { freqs: number[]; dur: number }> = {
        sell:  { freqs: [880, 660], dur: 0.12 },
        buy:   { freqs: [660, 880], dur: 0.12 },
        nudge: { freqs: [760],      dur: 0.08 },
      };

      const { freqs, dur } = configs[tone];
      const now = ctx.currentTime;

      freqs.forEach((freq, i) => {
        const o  = ctx.createOscillator();
        const g  = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type      = "sine";
        o.frequency.setValueAtTime(freq, now + i * (dur + 0.02));
        g.gain.setValueAtTime(0.18, now + i * (dur + 0.02));
        g.gain.exponentialRampToValueAtTime(0.001, now + i * (dur + 0.02) + dur);
        o.start(now + i * (dur + 0.02));
        o.stop(now + i * (dur + 0.02) + dur);
      });
    } catch {
      // AudioContext blocked (e.g. no user gesture yet) — fail silently
    }
  }, []);

  const browserNotify = useCallback((title: string, body: string) => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico", silent: true });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(perm => {
        if (perm === "granted") new Notification(title, { body, icon: "/favicon.ico", silent: true });
      });
    }
  }, []);

  return { beep, browserNotify };
}
