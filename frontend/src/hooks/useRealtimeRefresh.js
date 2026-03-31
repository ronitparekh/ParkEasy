import { useEffect, useRef } from "react";
import { subscribeDataUpdated } from "../realtime/socket";

export default function useRealtimeRefresh(callback, { enabled = true, minGapMs = 600 } = {}) {
  const callbackRef = useRef(callback);
  const lastRunRef = useRef(0);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;

    const unsubscribe = subscribeDataUpdated(() => {
      const now = Date.now();
      if (now - lastRunRef.current < Math.max(100, Number(minGapMs) || 600)) {
        return;
      }
      lastRunRef.current = now;
      Promise.resolve(callbackRef.current?.()).catch(() => {
        // Avoid breaking UI on transient realtime errors.
      });
    });

    return unsubscribe;
  }, [enabled, minGapMs]);
}