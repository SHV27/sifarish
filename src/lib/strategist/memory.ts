import type { Job, Packet, Reading } from '../../types'

/**
 * v2 R3 — THE MEMORY: the outcome loop as DATA he feeds (brief: "self evolves … recorded outcomes
 * change behaviour without anyone touching code", V2-2 §3: it starts empty and says so).
 *
 * Every application he moved (applied / interview / offer / rejected) is remembered with the
 * reader it was aimed at (the packet's Reading) and what the page led with (the plan's first
 * section). The strategist reads those lines as HINTS for the next posting with the same kind of
 * reader — never as rules: one rejection is one data point, and the board says how many exist.
 */
export interface OutcomeLine {
  company: string
  reader: Reading['readerPersona'] | 'unknown'
  archetype: string
  status: 'applied' | 'interview' | 'offer' | 'rejected'
  led: string
  when: string
}

const OUTCOME_STATUSES = new Set(['applied', 'interview', 'offer', 'rejected'])

export function outcomeLines(jobs: Job[], packets: Packet[]): OutcomeLine[] {
  const out: OutcomeLine[] = []
  for (const j of jobs) {
    if (!OUTCOME_STATUSES.has(j.status)) continue
    const p = packets.filter((x) => x.jobId === j.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    out.push({
      company: j.company,
      reader: p?.reading?.readerPersona ?? 'unknown',
      archetype: p?.reading?.archetype ?? '—',
      status: j.status as OutcomeLine['status'],
      led: p?.plan?.sectionOrder?.[0] ?? 'unknown',
      when: (j.appliedAt ?? j.updatedAt ?? j.fetchedAt ?? '').slice(0, 10),
    })
  }
  return out.sort((a, b) => b.when.localeCompare(a.when))
}

/** The lines for THIS reading: same reader type first, then the rest; counts stated plainly. */
export function memoryFor(lines: OutcomeLine[], reading: Reading): string[] {
  if (lines.length === 0) return ['no recorded outcomes yet — the outcome loop starts empty; every "mark as applied", interview and rejection you record teaches the next plan']
  const same = lines.filter((l) => l.reader === reading.readerPersona)
  const rest = lines.filter((l) => l.reader !== reading.readerPersona)
  const say = (l: OutcomeLine) => `${l.company} (${l.reader === 'unknown' ? 'reader unknown' : `${l.reader} reader`}, ${l.archetype}): ${l.status}${l.led !== 'unknown' ? ` — the page led with ${l.led}` : ''}`
  const out: string[] = []
  out.push(`${lines.length} recorded outcome${lines.length === 1 ? '' : 's'} (${lines.filter((l) => l.status === 'interview' || l.status === 'offer').length} interview/offer, ${lines.filter((l) => l.status === 'rejected').length} rejected)${lines.length < 5 ? ' — too few to learn a rule from; read as hints' : ''}`)
  for (const l of same.slice(0, 4)) out.push(`same kind of reader → ${say(l)}`)
  for (const l of rest.slice(0, 2)) out.push(say(l))
  return out
}

export function memoryForPrompt(lines: string[]): string {
  return `THE MEMORY (recorded outcomes of his past applications — hints for THIS reader, never rules)\n${lines.map((l) => `- ${l}`).join('\n')}`
}

/** Reads the vault (jobs + packets) — the only door; the strategist and the board share it. */
export async function loadMemory(reading: Reading): Promise<string[]> {
  try {
    const { db } = await import('../../db/db')
    const [jobs, packets] = await Promise.all([db.jobs.toArray(), db.packets.toArray()])
    return memoryFor(outcomeLines(jobs, packets), reading)
  } catch {
    return []
  }
}
