import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "../db/client";
import { getAllProfiles, upsertProfile, deleteProfile, touchLastUsed, StockProfile } from "../db/profileRepository";

export interface PricePoint {
  price:      number;
  bid:        number;
  ask:        number;
  spread:     number;
  volume:     number;
  time:       string;
  created_at: string;
}

export interface Signal {
  id:           string;
  symbol:       string;
  signal_type:  "BUY" | "SELL" | "HOLD";
  velocity:     number;
  acceleration: number;
  spread:       number;
  divergence:   number | null;
  score:        number;
  strength:     "WEAK" | "STRONG" | "ACTION";
  created_at:   string;
}

export interface LoadProgress {
  total:     number;
  done:      number;
  current:   string;
  startedAt: number;
  phase:     "profiles" | "prices" | "signals" | "peers" | "done";
}

export interface DashboardContextType {
  profiles:            StockProfile[];
  activeSymbol:        string;
  activeProfile:       StockProfile | null;
  setActiveSymbol:     (s: string) => void;
  saveProfile:         (data: Parameters<typeof upsertProfile>[0]) => Promise<void>;
  removeProfile:       (ticker: string) => Promise<void>;
  profilesLoading:     boolean;
  allPrices:           Record<string, PricePoint[]>;
  peerPrices:          Record<string, PricePoint[]>;
  signals:             Signal[];
  loading:             boolean;
  loadProgress:        LoadProgress;
  velocityInterval:    number;
  setVelocityInterval: (n: number) => void;
}

const STORAGE_KEY = "mfd_activeSymbol";

const defaultProgress: LoadProgress = {
  total: 0, done: 0, current: "", startedAt: Date.now(), phase: "profiles",
};

const DashboardContext = createContext<DashboardContextType | null>(null);

function toPricePoint(p: any): PricePoint {
  const bid = Number(p.bid ?? p.price);
  const ask = Number(p.ask ?? p.price);
  return {
    price:      Number(p.price),
    bid,
    ask,
    spread:     ask - bid,
    volume:     Number(p.volume ?? 0),
    time:       new Date(p.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    created_at: p.created_at,
  };
}

async function fetchPricesFor(
  symbols: string[],
  onProgress?: (done: number, current: string) => void
): Promise<Record<string, PricePoint[]>> {
  if (!symbols.length) return {};

  // Fetch all symbols in ONE query instead of N sequential queries
  // This cuts load time from N×latency to 1×latency
  const { data, error } = await supabase
    .from("price_history")
    .select("*")
    .in("symbol", symbols)
    .order("created_at", { ascending: true })
    .limit(120 * symbols.length); // enough rows for all symbols

  if (error) console.error("price batch fetch error", error.message);

  // Group by symbol
  const result: Record<string, PricePoint[]> = {};
  for (const sym of symbols) result[sym] = [];
  for (const row of (data || [])) {
    const sym = row.symbol as string;
    if (result[sym]) result[sym].push(toPricePoint(row));
    // Trim to last 120 per symbol
    if (result[sym].length > 120) result[sym] = result[sym].slice(-120);
  }

  onProgress?.(symbols.length, "");
  return result;
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [profiles,        setProfiles]        = useState<StockProfile[]>([]);
  const [activeSymbol,    setActiveSymbolRaw] = useState<string>(() =>
    (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) || "AAPL"
  );
  const [allPrices,       setAllPrices]       = useState<Record<string, PricePoint[]>>({});
  const [peerPrices,      setPeerPrices]      = useState<Record<string, PricePoint[]>>({});
  const [signals,         setSignals]         = useState<Signal[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [loadProgress,    setLoadProgress]    = useState<LoadProgress>(defaultProgress);
  const [velocityInterval, setVelocityIntervalRaw] = useState<number>(() =>
    typeof window !== "undefined" ? Number(localStorage.getItem("mfd_velInterval") || 10) : 10
  );

  const didLoad = useRef(false);
  const activeProfile = profiles.find(p => p.ticker === activeSymbol) ?? null;

  const setActiveSymbol = useCallback((s: string) => {
    setActiveSymbolRaw(s);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, s);
    // Update last_used timestamp in DB — non-blocking
    touchLastUsed(s).catch(() => {});
  }, []);

  const setVelocityInterval = useCallback((n: number) => {
    setVelocityIntervalRaw(n);
    if (typeof window !== "undefined") localStorage.setItem("mfd_velInterval", String(n));
  }, []);

  // ── ONE-TIME initial load — runs exactly once ──────────────────────────────
  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;

    (async () => {
      setLoading(true);
      const startedAt = Date.now();

      // Phase 1: profiles
      setLoadProgress({ total: 1, done: 0, current: "Loading profiles…", startedAt, phase: "profiles" });
      setProfilesLoading(true);
      let freshProfiles: StockProfile[] = [];
      try {
        freshProfiles = await getAllProfiles();
        setProfiles(freshProfiles);
        const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        if (!saved || !freshProfiles.find(p => p.ticker === saved)) {
          if (freshProfiles[0]) setActiveSymbolRaw(freshProfiles[0].ticker);
        }
      } catch (e: any) {
        console.error("Failed to load profiles:", e.message);
      } finally {
        setProfilesLoading(false);
      }

      const watchlist   = freshProfiles.map(p => p.ticker);
      const allPeerSyms = [...new Set(freshProfiles.flatMap(p => p.peers || []))];
      const total       = 3; // phases: prices, signals, peers (all parallel)

      // Fetch prices + signals + peer prices ALL in parallel — cuts load to ~1 DB round trip
      setLoadProgress({ total, done: 0, current: "Loading data…", startedAt, phase: "prices" });

      const [prices, signalsData, peerPricesData] = await Promise.all([
        // Watchlist prices
        fetchPricesFor(watchlist),
        // Signals
        Promise.resolve(
          supabase
            .from("signals")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(300)
        ).then(({ data, error }) => {
          if (error) console.error("signals fetch error:", error.message);
          return (data || []) as Signal[];
        }).catch((e: any) => {
          console.error("Failed to load signals:", e.message);
          return [] as Signal[];
        }),
        // Peer prices
        allPeerSyms.length > 0 ? fetchPricesFor(allPeerSyms) : Promise.resolve({}),
      ]);

      setAllPrices(prices);
      if (signalsData.length) setSignals(signalsData as Signal[]);
      if (allPeerSyms.length > 0) setPeerPrices(peerPricesData);

      setLoadProgress({ total, done: total, current: "", startedAt, phase: "done" });
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reload peer prices only when the active symbol's peers actually change ──
  const prevPeersKey = useRef("");
  useEffect(() => {
    const peers  = activeProfile?.peers || [];
    const newKey = peers.join(",");
    if (!peers.length || newKey === prevPeersKey.current) return;
    prevPeersKey.current = newKey;
    fetchPricesFor(peers).then(setPeerPrices);
  }, [activeProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime: incoming signals ─────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel("ctx-signals")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "signals" }, (payload: any) => {
        setSignals(prev => prev.some(s => s.id === payload.new.id) ? prev : [payload.new as Signal, ...prev]);
      })
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, []);

  // ── Realtime: incoming prices ──────────────────────────────────────────────
  useEffect(() => {
    if (!profiles.length) return;
    const watchlist = profiles.map(p => p.ticker);
    const allPeers  = profiles.flatMap(p => p.peers || []);
    const ch = supabase.channel("ctx-prices")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "price_history" }, (payload: any) => {
        const pt  = toPricePoint(payload.new);
        const sym = payload.new.symbol as string;
        if (watchlist.includes(sym))
          setAllPrices(prev => ({ ...prev, [sym]: [...(prev[sym] || []).slice(-119), pt] }));
        if (allPeers.includes(sym))
          setPeerPrices(prev => ({ ...prev, [sym]: [...(prev[sym] || []).slice(-119), pt] }));
      })
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [profiles]);

  // ── Profile mutations ──────────────────────────────────────────────────────
  const saveProfile = useCallback(async (data: Parameters<typeof upsertProfile>[0]) => {
    await upsertProfile(data);
    const updated = await getAllProfiles();
    setProfiles(updated);
  }, []);

  const removeProfile = useCallback(async (ticker: string) => {
    await deleteProfile(ticker);
    const updated = await getAllProfiles();
    setProfiles(updated);
  }, []);

  return (
    <DashboardContext.Provider value={{
      profiles, activeSymbol, activeProfile, setActiveSymbol,
      saveProfile, removeProfile, profilesLoading,
      allPrices, peerPrices, signals, loading, loadProgress,
      velocityInterval, setVelocityInterval,
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside DashboardProvider");
  return ctx;
}