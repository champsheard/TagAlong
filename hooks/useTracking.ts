import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { TrackingData } from "../shared/types";

export function useTracking(code: string) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [expired, setExpired] = useState(false), [now, setNow] = useState(Date.now());
  useEffect(() => {
    let alive = true, busy = false, ended = false;
    setData(null); setExpired(false); setLoading(true); setError("");
    const poll = async () => {
      if (!code || busy || ended) return;
      busy = true;
      try { const next = await api.track(code); if (alive) { setData(current => ({ ...next, route: current?.route ?? next.route })); setError(""); } }
      catch (e) {
        if (alive) {
          if (e instanceof ApiError && e.status === 404) { setData(null); setExpired(true); ended = true; }
          setError(e instanceof Error ? e.message : "Couldn't refresh this trip.");
        }
      } finally { busy = false; if (alive) setLoading(false); }
    };
    poll(); const timer = setInterval(poll, 5000), clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { alive = false; clearInterval(timer); clearInterval(clock); };
  }, [code]);
  return { data, loading, error, expired, now };
}
