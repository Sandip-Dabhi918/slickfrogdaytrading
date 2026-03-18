import { supabase } from "./db/client";

export function subscribeToSignals(callback: (signal: any) => void) {

  const channel = supabase
    .channel("signals-realtime")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "signals"
      },
      (payload) => {

        console.log("Realtime signal:", payload);

        callback(payload.new);

      }
    )
    .subscribe();

  return channel;
}