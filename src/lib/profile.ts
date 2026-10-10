import { earthBulge, fresnelRadius, fspl } from './fresnel'

export interface ElevSample {
  /** Distance from A, metres. */
  d: number
  /** Ground elevation, metres. */
  elev: number
}

export interface ProfilePoint {
  d: number
  ground: number
  /** Earth bulge at this point, metres. */
  bulge: number
  /** Ground + bulge: the terrain as seen against a straight ray. */
  terrain: number
  /** Straight line-of-sight height, metres above sea level. */
  los: number
  /** First Fresnel zone radius, metres. */
  f1: number
  /** los - terrain, metres (negative = blocked). */
  clearance: number
  /** clearance / f1 (NaN at the endpoints). */
  clearancePct: number
}

export interface Obstruction {
  startD: number
  endD: number
  /** Distance of the worst point, metres. */
  atD: number
  /** How far the terrain pokes above the line of sight, metres. */
  depth: number
}

export type LosStatus = 'clear' | 'ok' | 'partial' | 'blocked'

export interface Analysis {
  points: ProfilePoint[]
  total: number
  status: LosStatus
  minClearance: number
  minClearanceAt: number
  /** Smallest clearance as a fraction of the first Fresnel radius (interior points). */
  minPct: number
  minPctAt: number
  maxF1: number
  maxBulge: number
  obstructions: Obstruction[]
  /** Extra height (m) to add to both antennas for 60% / 100% first-zone clearance. */
  raise60: number
  raise100: number
  fsplDb: number
}

export interface AnalyzeInput {
  samples: ElevSample[]
  /** Antenna heights above local ground, metres. */
  hA: number
  hB: number
  fMHz: number
  /** Effective earth radius factor. */
  k: number
}

export function analyze({ samples, hA, hB, fMHz, k }: AnalyzeInput): Analysis {
  const total = samples[samples.length - 1].d
  const zA = samples[0].elev + hA
  const zB = samples[samples.length - 1].elev + hB
  const points: ProfilePoint[] = samples.map((s) => {
    const bulge = earthBulge(s.d, total - s.d, k)
    const terrain = s.elev + bulge
    const los = total > 0 ? zA + ((zB - zA) * s.d) / total : zA
    const f1 = fresnelRadius(1, fMHz, s.d, total - s.d)
    const clearance = los - terrain
    return { d: s.d, ground: s.elev, bulge, terrain, los, f1, clearance, clearancePct: f1 > 0 ? clearance / f1 : NaN }
  })

  let minC = Infinity
  let minCAt = 0
  let minPct = Infinity
  let minPctAt = 0
  let maxF1 = 0
  let maxBulge = 0
  let need60 = 0
  let need100 = 0
  for (const [i, p] of points.entries()) {
    // Endpoint clearance is just the antenna height, so only interior points count.
    if (p.clearance < minC && (i > 0 && i < points.length - 1 || points.length < 3)) {
      minC = p.clearance
      minCAt = p.d
    }
    if (p.f1 > 0 && p.clearancePct < minPct) {
      minPct = p.clearancePct
      minPctAt = p.d
    }
    maxF1 = Math.max(maxF1, p.f1)
    maxBulge = Math.max(maxBulge, p.bulge)
    if (p.f1 > 0) {
      need60 = Math.max(need60, 0.6 * p.f1 - p.clearance)
      need100 = Math.max(need100, p.f1 - p.clearance)
    }
  }
  if (!Number.isFinite(minPct)) minPct = minC > 0 ? Infinity : 0

  const obstructions: Obstruction[] = []
  let cur: Obstruction | null = null
  for (const p of points) {
    if (p.clearance < 0) {
      if (!cur) {
        cur = { startD: p.d, endD: p.d, atD: p.d, depth: -p.clearance }
        obstructions.push(cur)
      }
      cur.endD = p.d
      if (-p.clearance > cur.depth) {
        cur.depth = -p.clearance
        cur.atD = p.d
      }
    } else cur = null
  }

  const status: LosStatus = minC < 0 ? 'blocked' : minPct >= 1 ? 'clear' : minPct >= 0.6 ? 'ok' : 'partial'
  return {
    points,
    total,
    status,
    minClearance: minC,
    minClearanceAt: minCAt,
    minPct,
    minPctAt,
    maxF1,
    maxBulge,
    obstructions,
    raise60: Math.max(0, need60),
    raise100: Math.max(0, need100),
    fsplDb: total > 0 ? fspl(total, fMHz) : 0,
  }
}

/** CSV export of the analysed profile. */
export function toCsv(a: Analysis): string {
  const rows = ['distance_m,ground_m,earth_bulge_m,los_m,fresnel1_m,clearance_m,clearance_pct_of_f1']
  for (const p of a.points) {
    rows.push(
      [p.d, p.ground, p.bulge, p.los, p.f1, p.clearance, Number.isNaN(p.clearancePct) ? '' : p.clearancePct * 100].map((v) => (typeof v === 'number' ? +v.toFixed(2) : v)).join(','),
    )
  }
  return rows.join('\n') + '\n'
}
