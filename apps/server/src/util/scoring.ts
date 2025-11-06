export function scoreForGuess(remainingMs: number) {
  const base = 300;           // max points for instant guess
  const turnMs = 75_000;      // must match engine TURN_MS
  const ratio = Math.min(Math.max(remainingMs / turnMs, 0), 1);
  return Math.max(50, Math.round(base * ratio));
}

export function drawerBonus(guesserGain: number) {
  return Math.round(guesserGain * 0.3);
}
