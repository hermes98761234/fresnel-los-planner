import { describe, expect, it } from 'vitest'
import { earthBulge, fresnelRadius } from './fresnel'
import { analyze, toCsv, type ElevSample } from './profile'

const flat = (n: number, total: number, elev = 100): ElevSample[] => Array.from({ length: n }, (_, i) => ({ d: (total * i) / (n - 1), elev }))

describe('analyze', () => {
  it('flat terrain: clearance at the middle is antenna height minus bulge', () => {
    const a = analyze({ samples: flat(101, 20000), hA: 30, hB: 30, fMHz: 2400, k: 4 / 3 })
    const mid = a.points[50]
    expect(mid.bulge).toBeCloseTo(earthBulge(10000, 10000, 4 / 3), 9)
    expect(mid.clearance).toBeCloseTo(30 - 5.886, 2)
    expect(mid.f1).toBeCloseTo(fresnelRadius(1, 2400, 10000, 10000), 9)
    expect(a.minClearance).toBeCloseTo(30 - 5.886, 2)
    expect(a.minClearanceAt).toBeCloseTo(10000, 6)
  })
  it('classifies clear / ok / partial / blocked', () => {
    const base = { samples: flat(101, 10000), fMHz: 2400, k: 4 / 3 }
    // mid F1 = 17.67 m, bulge 1.47 m
    expect(analyze({ ...base, hA: 40, hB: 40 }).status).toBe('clear')
    expect(analyze({ ...base, hA: 17, hB: 17 }).status).toBe('ok') // (17-1.47)/17.67 = 0.88
    expect(analyze({ ...base, hA: 10, hB: 10 }).status).toBe('partial') // 0.48
    expect(analyze({ ...base, hA: 1, hB: 1 }).status).toBe('blocked')
  })
  it('finds a ridge as an obstruction with its depth', () => {
    const s = flat(101, 10000)
    for (let i = 48; i <= 52; i++) s[i].elev = 150
    s[50].elev = 180
    const a = analyze({ samples: s, hA: 10, hB: 10, fMHz: 900, k: 4 / 3 })
    expect(a.status).toBe('blocked')
    expect(a.obstructions).toHaveLength(1)
    const o = a.obstructions[0]
    expect(o.atD).toBeCloseTo(5000, 6)
    expect(o.startD).toBeCloseTo(4800, 6)
    expect(o.endD).toBeCloseTo(5200, 6)
    // LOS at 110 m, terrain 180 + 1.47 m bulge
    expect(o.depth).toBeCloseTo(180 + earthBulge(5000, 5000, 4 / 3) - 110, 6)
  })
  it('raising both antennas by raise60/raise100 reaches the target', () => {
    const s = flat(101, 15000)
    s[40].elev = 140
    const base = { samples: s, fMHz: 5800, k: 4 / 3 }
    const a = analyze({ ...base, hA: 15, hB: 15 })
    expect(a.raise60).toBeGreaterThan(0)
    const b = analyze({ ...base, hA: 15 + a.raise60, hB: 15 + a.raise60 })
    expect(b.minPct).toBeCloseTo(0.6, 6)
    const c = analyze({ ...base, hA: 15 + a.raise100, hB: 15 + a.raise100 })
    expect(c.minPct).toBeCloseTo(1, 6)
    expect(c.status).toBe('clear')
    expect(analyze({ ...base, hA: 15 + a.raise100, hB: 15 + a.raise100 }).raise100).toBeCloseTo(0, 6)
  })
  it('a smaller k (sub-refraction) raises the bulge and reduces clearance', () => {
    const base = { samples: flat(101, 30000), hA: 40, hB: 40, fMHz: 900 }
    expect(analyze({ ...base, k: 2 / 3 }).minClearance).toBeLessThan(analyze({ ...base, k: 4 / 3 }).minClearance)
  })
  it('reports free-space loss and exports CSV', () => {
    const a = analyze({ samples: flat(11, 10000), hA: 10, hB: 10, fMHz: 2400, k: 4 / 3 })
    expect(a.fsplDb).toBeCloseTo(120.04, 2)
    const lines = toCsv(a).trim().split('\n')
    expect(lines).toHaveLength(12)
    expect(lines[0]).toContain('distance_m')
  })
})
