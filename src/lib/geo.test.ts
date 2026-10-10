import { describe, expect, it } from 'vitest'
import { haversine, interpolate } from './geo'

describe('geo', () => {
  it('one degree of latitude is 111.195 km', () => {
    expect(haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111195, -1)
  })
  it('is symmetric and zero for identical points', () => {
    const a = { lat: 48.1, lon: 24.5 }
    const b = { lat: 50.4, lon: 30.5 }
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 6)
    expect(haversine(a, a)).toBe(0)
  })
  it('London to Paris is about 343 km', () => {
    const d = haversine({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 })
    expect(d / 1000).toBeGreaterThan(341)
    expect(d / 1000).toBeLessThan(345)
  })
  it('interpolates endpoints and the equatorial midpoint', () => {
    const a = { lat: 0, lon: 0 }
    const b = { lat: 0, lon: 90 }
    expect(interpolate(a, b, 0)).toEqual({ lat: 0, lon: 0 })
    const m = interpolate(a, b, 0.5)
    expect(m.lat).toBeCloseTo(0, 9)
    expect(m.lon).toBeCloseTo(45, 9)
    expect(haversine(a, interpolate(a, b, 0.25))).toBeCloseTo(haversine(a, b) / 4, 3)
  })
  it('handles coincident points', () => {
    expect(interpolate({ lat: 10, lon: 10 }, { lat: 10, lon: 10 }, 0.5)).toEqual({ lat: 10, lon: 10 })
  })
})
