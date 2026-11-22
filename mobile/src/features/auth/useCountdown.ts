import { useCallback, useEffect, useState } from 'react';

/** Обратный отсчёт в секундах; restart(sec) запускает заново. */
export function useCountdown(initialSeconds: number) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const restart = useCallback((next: number) => setSeconds(next), []);
  return { seconds, restart };
}
