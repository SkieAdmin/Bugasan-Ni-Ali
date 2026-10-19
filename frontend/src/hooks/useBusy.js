import { useCallback, useRef, useState } from 'react';

// For buttons that call the server: `busy` is true while the action runs (show a spinner),
// and taps during that time are ignored, so an order is never placed or advanced twice.
//   const [busy, run] = useBusy();
//   <Button loading={busy} onPress={() => run(save)} />
export function useBusy() {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  const run = useCallback(async (fn) => {
    if (running.current) return undefined;
    running.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  return [busy, run];
}
