/**
 * CSS-style cubic-bézier easing for pure code paths that can't use GSAP's
 * registered eases (e.g. deterministic math evaluated outside a timeline).
 * Same curve definitions as MOTION_EASE_CURVES, so motion stays consistent.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const sample = (a1: number, a2: number, t: number) =>
    ((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t * t + 3 * a1 * t;
  const slope = (a1: number, a2: number, t: number) =>
    3 * (1 - 3 * a2 + 3 * a1) * t * t + 2 * (3 * a2 - 6 * a1) * t + 3 * a1;

  const solveT = (x: number) => {
    // Newton–Raphson, falling back to bisection for flat slopes.
    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = sample(x1, x2, t) - x;
      if (Math.abs(error) < 1e-6) return t;
      const d = slope(x1, x2, t);
      if (Math.abs(d) < 1e-6) break;
      t -= error / d;
    }
    let low = 0;
    let high = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const value = sample(x1, x2, t);
      if (Math.abs(value - x) < 1e-6) break;
      if (value < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return t;
  };

  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sample(y1, y2, solveT(t));
  };
}
