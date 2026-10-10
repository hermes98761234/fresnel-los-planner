import { describe, expect, it } from 'vitest'
import { earthBulge, fresnelRadius, fspl, wavelength } from './fresnel'

describe('fresnel', () => {
  it('wavelength at 300 MHz is about 1 m', () => {
    expect(wavelength(300)).toBeCloseTo(0.99931, 4)
  })
  it('first zone at midpoint of a 10 km, 2.4 GHz link is 17.67 m', () => {
    expect(fresnelRadius(1, 2400, 5000, 5000)).toBeCloseTo(17.671, 2)
  })
  it('matches the 17.32*sqrt(d1*d2/(f*d)) rule of thumb', () => {
    const r = fresnelRadius(1, 5800, 3000, 7000)
    expect(r).toBeCloseTo(17.32 * Math.sqrt((3 * 7) / (5.8 * 10)), 1)
  })
  it('n-th zone scales with sqrt(n) and vanishes at the ends', () => {
    expect(fresnelRadius(4, 900, 2000, 8000)).toBeCloseTo(2 * fresnelRadius(1, 900, 2000, 8000), 9)
    expect(fresnelRadius(1, 900, 0, 8000)).toBe(0)
  })
  it('earth bulge at the middle of a 20 km path with k=4/3 is 5.89 m', () => {
    expect(earthBulge(10000, 10000, 4 / 3)).toBeCloseTo(5.886, 2)
  })
  it('bulge is inversely proportional to k', () => {
    expect(earthBulge(5000, 15000, 1)).toBeCloseTo(2 * earthBulge(5000, 15000, 2), 9)
  })
  it('FSPL of 10 km at 2.4 GHz is 120.04 dB', () => {
    expect(fspl(10000, 2400)).toBeCloseTo(120.04, 2)
  })
})
