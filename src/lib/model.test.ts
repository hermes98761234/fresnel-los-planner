import { describe, expect, it } from 'vitest'
import { applyPreset, defaultState, freqMHz, fromLen, parseState, PRESETS, toDist, toLen } from './model'

describe('model', () => {
  it('converts lengths and distances', () => {
    expect(toLen(100, 'imperial')).toBeCloseTo(328.084, 3)
    expect(fromLen(toLen(37.5, 'imperial'), 'imperial')).toBeCloseTo(37.5, 9)
    expect(toDist(1609.344, 'imperial')).toBeCloseTo(1, 9)
    expect(toDist(2500, 'metric')).toBe(2.5)
  })
  it('converts frequency units', () => {
    expect(freqMHz({ freq: 2.4, fUnit: 'GHz' })).toBe(2400)
    expect(freqMHz({ freq: 433, fUnit: 'MHz' })).toBe(433)
  })
  it('applies a preset in the current unit', () => {
    const s = applyPreset({ ...defaultState(), unit: 'imperial' }, PRESETS[2])
    expect(s.hA).toBeCloseTo(65.6, 1)
    expect(s.freq).toBe(2.4)
  })
  it('falls back to defaults on bad stored data', () => {
    const d = defaultState()
    expect(parseState(null)).toEqual(d)
    expect(parseState('not json')).toEqual(d)
    const s = parseState(JSON.stringify({ a: { lat: 99, lon: 0 }, hA: -5, k: 1, unit: 'imperial' }))
    expect(s.a).toEqual(d.a)
    expect(s.hA).toBe(d.hA)
    expect(s.k).toBe(1)
    expect(s.unit).toBe('imperial')
  })
})
