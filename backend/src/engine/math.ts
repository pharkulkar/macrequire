export const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

export const round = (v: number, dp = 1) => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

/** Piecewise-linear interpolation over [x, y] points sorted by x; clamps outside the range. */
export function interp(points: [number, number][], x: number): number {
  if (!points.length) return 0;
  if (x <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

export const formatStorage = (gb: number) => (gb >= 1024 ? `${round(gb / 1024, 1)}TB` : `${Math.round(gb)}GB`);
