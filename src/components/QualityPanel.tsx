import { useState } from 'react'
import type { CompileQuality } from '../types'

/**
 * Compile Quality (P13) — the Ustaad estimator, rendered honestly. The score is a transparent
 * rubric over the compiled page ("how well did the compile execute the craft"), NEVER an ATS
 * guarantee (I9): real ATS ranking varies by system, and this panel says so. Every missing
 * point is itemized — evidence gaps point at the ledger, choices carry their rationale.
 */
export default function QualityPanel({ quality }: { quality: CompileQuality }) {
  const [open, setOpen] = useState(false)
  const missing = 100 - quality.score
  const tone = quality.score >= 90 ? 'text-shipped' : quality.score >= 75 ? 'text-forge' : 'text-stamp'

  return (
    <section className="dossier p-4" aria-label="Compile quality">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display font-semibold text-ink text-sm">Compile Quality</h2>
        <span className={`font-mono text-lg font-bold ${tone}`}>{quality.score}/100</span>
      </div>
      <p className="mt-1 text-[11px] text-ink-soft leading-relaxed">
        {missing === 0
          ? 'Every rubric point earned — the page is the maximum honest presentation of the ledger.'
          : `Here's the missing ${missing} — each point is an evidence gap or a deliberate choice, never a mystery.`}
      </p>
      <ul className="mt-2 space-y-1">
        {quality.items
          .filter((i) => i.max > 0)
          .map((i) => (
            <li key={i.label} className="text-xs flex items-baseline justify-between gap-2">
              <span className="text-ink">{i.label}</span>
              <span className={`font-mono text-[11px] ${i.points === i.max ? 'text-shipped' : 'text-forge'}`}>
                {i.points}/{i.max}
              </span>
            </li>
          ))}
      </ul>
      <button className="mt-2 text-[11px] text-ink-soft hover:underline" onClick={() => setOpen((o) => !o)}>
        {open ? 'hide the itemized reasons' : 'show the itemized reasons'}
      </button>
      {open && (
        <ul className="mt-2 space-y-2 border-t border-ink-wash pt-2">
          {quality.items.map((i) => (
            <li key={`${i.label}-why`} className="text-[11px] leading-relaxed text-ink-soft">
              <span
                className={`stamp !text-[9px] !rotate-0 mr-1 ${i.kind === 'ok' ? 'stamp-shipped' : i.kind === 'gap' ? 'stamp-red' : 'stamp-forge'}`}
              >
                {i.kind === 'ok' ? 'earned' : i.kind === 'gap' ? 'evidence gap' : 'choice'}
              </span>
              <strong className="text-ink">{i.label}.</strong> {i.why}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-ink-soft leading-relaxed">
        A rubric estimate of craft execution, not an ATS score — real ATS ranking varies by system, and no tool
        can promise one.
      </p>
    </section>
  )
}
