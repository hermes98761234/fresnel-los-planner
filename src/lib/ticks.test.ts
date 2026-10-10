import { describe, expect, it } from 'vitest'
import { niceTicks } from './ticks'

describe('niceTicks', () => {
  it('produces round steps inside the range', () => {
    expect(niceTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100])
    expect(niceTicks(3, 27, 5)).toEqual([5, 10, 15, 20, 25])
  })
  it('handles fractions and degenerate ranges', () => {
    expect(niceTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1])
    expect(niceTicks(5, 5)).toEqual([5])
  })
})
