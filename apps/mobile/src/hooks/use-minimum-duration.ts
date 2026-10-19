import { useEffect, useState } from 'react';

/** When this JavaScript bundle started, i.e. the cold start of the app. */
const STARTED_AT = Date.now();

/**
 * True once at least `ms` have passed since the app started. Used to hold
 * the launch screen long enough to be read: without it a signed-out session
 * check finishes in a few milliseconds and the splash only flickers. Later
 * mounts, after the time has passed, are true at once.
 */
export function useMinimumDuration(ms: number): boolean {
  const remaining = () => Math.max(0, STARTED_AT + ms - Date.now());
  const [done, setDone] = useState(() => remaining() === 0);

  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => setDone(true), remaining());
    return () => clearTimeout(timer);
  }, [done]);

  return done;
}
