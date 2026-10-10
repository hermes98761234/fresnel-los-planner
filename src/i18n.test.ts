import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { tr, UK } from './i18n'

describe('i18n', () => {
  it('interpolates placeholders', () => {
    expect(tr('en', '{0} and {1}', 'a', 2)).toBe('a and 2')
    expect(tr('uk', 'Distance ({0})', 'км')).toBe('Відстань (км)')
  })
  it('falls back to English for unknown strings', () => {
    expect(tr('uk', 'No such string {0}', 1)).toBe('No such string 1')
  })
  it('keeps placeholders consistent between languages', () => {
    for (const [en, uk] of Object.entries(UK)) {
      const ph = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join()
      expect(ph(uk), en).toBe(ph(en))
    }
  })
  it('translates every literal t("...") string used in the UI', () => {
    const src = ['App.tsx', 'components/ProfileChart.tsx'].map((f) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')).join('\n')
    const missing = [...src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'")).filter((s) => !(s in UK))
    expect(missing).toEqual([])
  })
})
