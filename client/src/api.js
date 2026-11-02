import { useCallback, useEffect, useState } from "react";

async function request(path, signal) {
  const res = await fetch(path, { signal });
  if (!res.ok) {
    let msg = "";
    try { msg = (await res.json()).error; } catch { /* abaikan */ }
    throw new Error(msg || `Permintaan gagal (${res.status})`);
  }
  return res.json();
}

/** Mengambil data dengan polling opsional. Data lama dipertahankan saat memuat ulang. */
export function useApi(path, { interval = 0, enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true, updatedAt: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const ctrl = new AbortController();
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    request(path, ctrl.signal)
      .then((data) => alive && setState({ data, error: null, loading: false, updatedAt: new Date() }))
      .catch((error) => {
        if (error.name === "AbortError") return;
        if (alive) setState((s) => ({ ...s, error, loading: false }));
      });
    return () => { alive = false; ctrl.abort(); };
  }, [path, tick, enabled]);

  useEffect(() => {
    if (!interval) return undefined;
    const t = setInterval(() => setTick((x) => x + 1), interval);
    return () => clearInterval(t);
  }, [interval]);

  const refresh = useCallback(() => setTick((x) => x + 1), []);
  return { ...state, refresh };
}
