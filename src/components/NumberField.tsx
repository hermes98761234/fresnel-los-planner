import { useState } from 'react'

interface Props {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number | 'any'
}

/** Number input that keeps a text draft so partial entries ("-", "12.") don't fight the model. */
export default function NumberField({ label, value, onChange, min, max, step = 'any' }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(value)
  const n = Number(shown)
  const bad = shown.trim() === '' || !Number.isFinite(n) || (min !== undefined && n < min) || (max !== undefined && n > max)
  return (
    <div className="field">
      <label>
        {label}
        <input
          type="number"
          inputMode="decimal"
          value={shown}
          min={min}
          max={max}
          step={step}
          className={bad ? 'bad' : undefined}
          aria-invalid={bad}
          onChange={(e) => {
            setDraft(e.target.value)
            const v = Number(e.target.value)
            const ok = e.target.value.trim() !== '' && Number.isFinite(v) && (min === undefined || v >= min) && (max === undefined || v <= max)
            if (ok) onChange(v)
          }}
          onBlur={() => setDraft(null)}
        />
      </label>
    </div>
  )
}
