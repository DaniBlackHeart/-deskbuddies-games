// Countdown timers (Timer.tsx) compute "time remaining" as an absolute
// server-computed deadline minus the device's own clock. If a device's
// system clock is set wrong — not rare in practice — every timer on that
// device reads as already expired (or badly off) from the moment it
// renders, no matter which game it's in, since Timer.tsx is shared.
//
// Every Edge Function response that carries a *_deadline_ms field also
// carries server_now_ms (the server's own clock at response time). Whatever
// page fetches that response should call recordServerTime() with it — this
// is a single module-level offset, not per-component state, so any <Timer>
// anywhere on the page benefits immediately, and it keeps correcting itself
// as fresher responses come in.
//
// This is a best-effort correction (it doesn't subtract network round-trip
// time), but going from "no correction at all" to "correct within roughly a
// round trip" is what actually matters for a clock that's off by minutes,
// hours, or a wrong timezone/DST offset — the realistic causes in practice.
let offsetMs = 0;

export function recordServerTime(serverNowMs: number | null | undefined) {
  if (typeof serverNowMs !== "number") return;
  offsetMs = serverNowMs - Date.now();
}

export function correctedNow(): number {
  return Date.now() + offsetMs;
}
