import { useEffect, useMemo, useState } from 'react'
import { haversine, type LatLon } from './lib/geo'
import { analyze, toCsv } from './lib/profile'
import { applyPreset, distUnit, freqMHz, fromLen, lenUnit, loadState, PRESETS, round1, saveState, toDist, toLen, type AppState, type FUnit, type Lang, type Theme, type Unit } from './lib/model'
import { tr, type T } from './i18n'
import { useTerrain } from './useTerrain'
import MapView from './components/MapView'
import NumberField from './components/NumberField'
import ProfileChart from './components/ProfileChart'

const K_PRESETS = [
  { k: 1, label: 'Geometric (k = 1)' },
  { k: 4 / 3, label: 'Standard atmosphere (k = 4/3)' },
  { k: 2 / 3, label: 'Sub-refraction (k = 2/3)' },
]
const FREQ_CHIPS: [number, FUnit][] = [[433, 'MHz'], [868, 'MHz'], [2.4, 'GHz'], [5.8, 'GHz'], [10, 'GHz']]

export default function App() {
  const [state, setState] = useState<AppState>(loadState)
  const [placing, setPlacing] = useState<'a' | 'b'>('a')
  const [fitKey, setFitKey] = useState(0)
  const [retry, setRetry] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const { a, b, hA, hB, freq, fUnit, k, unit, lang, theme } = state
  const t: T = (s, ...args) => tr(lang, s, ...args)
  const update = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }))

  useEffect(() => saveState(state), [state])
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = theme
    root.lang = lang
  }, [theme, lang])

  const terrain = useTerrain(a, b, retry)
  const distance = haversine(a, b)
  const fMHz = freqMHz(state)
  const analysis = useMemo(() => {
    if (terrain.status !== 'ready' || distance < 20) return null
    return analyze({ samples: terrain.profile.samples, hA: fromLen(hA, unit), hB: fromLen(hB, unit), fMHz, k })
  }, [terrain, distance, hA, hB, unit, fMHz, k])

  const lu = t(lenUnit(unit))
  const du = t(distUnit(unit))
  const len = (m: number) => `${toLen(m, unit).toFixed(1)} ${lu}`
  const dist = (m: number) => `${toDist(m, unit).toFixed(2)} ${du}`
  const pct = (v: number) => (v > 9.99 ? '>999' : String(Math.round(v * 100)))

  const setUnit = (u: Unit) => update({ unit: u, hA: round1(toLen(fromLen(hA, unit), u)), hB: round1(toLen(fromLen(hB, unit), u)) })
  const pickPoint = (p: LatLon) => {
    update({ [placing]: p })
    setPlacing(placing === 'a' ? 'b' : 'a')
  }
  const download = () => {
    if (!analysis) return
    const url = URL.createObjectURL(new Blob([toCsv(analysis)], { type: 'text/csv' }))
    const el = document.createElement('a')
    el.href = url
    el.download = 'los-profile.csv'
    el.click()
    URL.revokeObjectURL(url)
  }

  const hoverPt = terrain.status === 'ready' && hover !== null ? terrain.profile.samples[hover] : null
  const hp = analysis && hover !== null ? analysis.points[hover] : null

  let verdict: { cls: string; text: string } | null = null
  if (analysis) {
    const worst = analysis.points.reduce((m, p) => (p.clearance < m.clearance ? p : m))
    verdict = {
      clear: { cls: 'ok', text: t('Line of sight is clear and the first Fresnel zone is free.') },
      ok: { cls: 'ok', text: t('Line of sight is usable: at least 60% of the first Fresnel zone is clear.') },
      partial: { cls: 'warn', text: t('Line of sight exists, but the Fresnel zone is obstructed: only {0}% clear at {1}.', pct(analysis.minPct), dist(analysis.minPctAt)) },
      blocked: { cls: 'err', text: t('Line of sight is blocked: terrain rises {0} above the path at {1}.', len(-worst.clearance), dist(worst.d)) },
    }[analysis.status]
  }

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{t('Fresnel & line-of-sight planner')}</span>
        <span className="hint">{t('Pick two points on the map and check the radio path over real terrain.')}</span>
      </header>
      <div className="body">
        <aside className="side">
          <div className="panel">
            <div className="section">
              <h3>{t('Examples')}</h3>
              <select
                aria-label={t('Examples')}
                value=""
                onChange={(e) => {
                  const p = PRESETS[+e.target.value]
                  if (!p) return
                  setState((s) => applyPreset(s, p))
                  setFitKey((n) => n + 1)
                }}
              >
                <option value="">{t('Load an example path…')}</option>
                {PRESETS.map((p, i) => <option key={p.name} value={i}>{t(p.name)}</option>)}
              </select>
            </div>

            <div className="section">
              <h3>{t('Endpoints')}</h3>
              <p className="hint">{t('Click the map to place a point, or drag the markers.')}</p>
              <div className="row">
                <span className="hint">{t('Next click sets')}</span>
                <button className={placing === 'a' ? 'on' : ''} aria-pressed={placing === 'a'} onClick={() => setPlacing('a')}>A</button>
                <button className={placing === 'b' ? 'on' : ''} aria-pressed={placing === 'b'} onClick={() => setPlacing('b')}>B</button>
                <span className="spacer" />
                <button className="small" onClick={() => update({ a: b, b: a })}>{t('Swap')}</button>
                <button className="small" onClick={() => setFitKey((n) => n + 1)}>{t('Zoom to path')}</button>
              </div>
              <div className="grid2">
                <NumberField label={t('A latitude')} value={a.lat} min={-85} max={85} onChange={(v) => update({ a: { ...a, lat: v } })} />
                <NumberField label={t('A longitude')} value={a.lon} min={-180} max={180} onChange={(v) => update({ a: { ...a, lon: v } })} />
                <NumberField label={t('B latitude')} value={b.lat} min={-85} max={85} onChange={(v) => update({ b: { ...b, lat: v } })} />
                <NumberField label={t('B longitude')} value={b.lon} min={-180} max={180} onChange={(v) => update({ b: { ...b, lon: v } })} />
              </div>
            </div>

            <div className="section">
              <h3>{t('Antennas')}</h3>
              <div className="grid2">
                <NumberField label={t('Height at A ({0})', lu)} value={hA} min={0} max={10000} onChange={(v) => update({ hA: v })} />
                <NumberField label={t('Height at B ({0})', lu)} value={hB} min={0} max={10000} onChange={(v) => update({ hB: v })} />
              </div>
              <p className="hint">{t('Height above local ground level.')}</p>
            </div>

            <div className="section">
              <h3>{t('Radio')}</h3>
              <div className="grid2">
                <NumberField label={t('Frequency')} value={freq} min={0.001} max={1000000} onChange={(v) => update({ freq: v })} />
                <div className="field">
                  <label>
                    {t('Unit')}
                    <select value={fUnit} onChange={(e) => update({ fUnit: e.target.value as FUnit })}>
                      <option value="MHz">MHz</option>
                      <option value="GHz">GHz</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="row">
                {FREQ_CHIPS.map(([v, u]) => (
                  <button key={`${v}${u}`} className="small" onClick={() => update({ freq: v, fUnit: u })}>{v} {u}</button>
                ))}
              </div>
              <div className="field">
                <label>
                  {t('Earth radius factor k')}
                  <select value={K_PRESETS.some((p) => Math.abs(p.k - k) < 1e-9) ? String(k) : 'custom'} onChange={(e) => e.target.value !== 'custom' && update({ k: +e.target.value })}>
                    {K_PRESETS.map((p) => <option key={p.label} value={String(p.k)}>{t(p.label)}</option>)}
                    <option value="custom">{t('Custom')}</option>
                  </select>
                </label>
              </div>
              <NumberField label={t('k value')} value={+k.toFixed(4)} min={0.3} max={10} onChange={(v) => update({ k: v })} />
            </div>

            <div className="section">
              <h3>{t('Settings')}</h3>
              <div className="grid3">
                <div className="field">
                  <label>
                    {t('Units')}
                    <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                      <option value="metric">{t('Metric')}</option>
                      <option value="imperial">{t('Imperial')}</option>
                    </select>
                  </label>
                </div>
                <div className="field">
                  <label>
                    {t('Language')}
                    <select value={lang} onChange={(e) => update({ lang: e.target.value as Lang })}>
                      <option value="en">English</option>
                      <option value="uk">Українська</option>
                    </select>
                  </label>
                </div>
                <div className="field">
                  <label>
                    {t('Theme')}
                    <select value={theme} onChange={(e) => update({ theme: e.target.value as Theme })}>
                      <option value="auto">{t('System')}</option>
                      <option value="light">{t('Light')}</option>
                      <option value="dark">{t('Dark')}</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="main">
          <div className="box mapbox">
            <MapView a={a} b={b} hover={hoverPt} fitKey={fitKey} label={t('Map')} onClick={pickPoint} onMove={(w, p) => update({ [w]: p })} />
          </div>

          {analysis && (
            <div className="box">
              <div className="row">
                <h3 className="grow">{t('Path profile')}</h3>
                <button className="small" onClick={download}>{t('Download CSV')}</button>
              </div>
              <ProfileChart analysis={analysis} unit={unit} hover={hover} onHover={setHover} t={t} />
              <p className="readout">
                {hp
                  ? t('{0}: ground {1}, line of sight {2}, clearance {3} ({4}% of 1st zone)', dist(hp.d), len(hp.ground), len(hp.los), len(hp.clearance), Number.isNaN(hp.clearancePct) ? '–' : pct(hp.clearancePct))
                  : t('Hover or touch the chart to inspect a point.')}
              </p>
            </div>
          )}
          <div className="box">
            <h3>{t('Result')}</h3>
            {distance < 20 ? (
              <p className="verdict warn">{t('Points A and B are too close together.')}</p>
            ) : terrain.status === 'loading' ? (
              <p className="verdict">{t('Loading terrain…')}</p>
            ) : terrain.status === 'error' ? (
              <p className="verdict err">
                {t('Could not load terrain data: {0}', terrain.message)}{' '}
                <button className="small" onClick={() => setRetry((n) => n + 1)}>{t('Retry')}</button>
              </p>
            ) : (
              verdict && <p className={`verdict ${verdict.cls}`}>{verdict.text}</p>
            )}

            {analysis && terrain.status === 'ready' && (
              <>
                <table className="data">
                  <tbody>
                    <tr><td>{t('Path length')}</td><td>{dist(analysis.total)}</td></tr>
                    <tr><td>{t('Ground elevation at A / B')}</td><td>{len(analysis.points[0].ground)} / {len(analysis.points[analysis.points.length - 1].ground)}</td></tr>
                    <tr><td>{t('Smallest clearance')}</td><td>{len(analysis.minClearance)} {t('at {0}', dist(analysis.minClearanceAt))}</td></tr>
                    <tr><td>{t('Smallest clearance vs 1st zone')}</td><td>{pct(analysis.minPct)}% {t('at {0}', dist(analysis.minPctAt))}</td></tr>
                    <tr><td>{t('1st Fresnel radius (max)')}</td><td>{len(analysis.maxF1)}</td></tr>
                    <tr><td>{t('Earth bulge (max)')}</td><td>{len(analysis.maxBulge)}</td></tr>
                    <tr><td>{t('Free-space path loss')}</td><td>{analysis.fsplDb.toFixed(1)} dB</td></tr>
                    <tr><td>{t('Raise both antennas for 60% / 100%')}</td><td>{len(analysis.raise60)} / {len(analysis.raise100)}</td></tr>
                    <tr><td>{t('Terrain data')}</td><td>{t('zoom {0}, about {1} per pixel', terrain.profile.zoom, len(terrain.profile.resolution))}</td></tr>
                  </tbody>
                </table>
                {analysis.obstructions.length > 0 && (
                  <ul className="warnlist">
                    {analysis.obstructions.slice(0, 6).map((o) => (
                      <li key={o.atD} className="err-text">
                        {t('Obstruction from {0} to {1}: terrain {2} above the line at {3}.', dist(o.startD), dist(o.endD), len(o.depth), dist(o.atD))}
                      </li>
                    ))}
                  </ul>
                )}
                {k < 1 && <p className="hint warn-text">{t('k below 1 models sub-refraction, which makes the earth bulge larger.')}</p>}
              </>
            )}
            <p className="hint">{t('Elevation comes from terrain tiles only: trees, buildings and masts are not included, so leave extra margin.')}</p>
          </div>

        </main>
      </div>
      <p className="hint foot">
        {t('Map © OpenStreetMap contributors. Terrain: AWS Terrain Tiles. Everything runs in your browser.')}{' '}
        <a href="https://github.com/hermes98761234/fresnel-los-planner">{t('Source on GitHub')}</a>
      </p>
    </div>
  )
}
