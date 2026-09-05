import type { SectionDef } from '../../types'

/**
 * v2 THE DOSSIER — the sections registry seed: the campus canon's sections plus the custom kinds
 * his facts already use. Sections are created on demand from chat; this is only the starting map.
 * Lives outside the db layer so the compiler can read labels without importing Dexie.
 */
export const DEFAULT_SECTIONS: SectionDef[] = [
  { kind: 'education', label: 'Education', order: 10 },
  { kind: 'experience', label: 'Experience', order: 20 },
  { kind: 'project', label: 'Projects', order: 30 },
  { kind: 'skill', label: 'Technical Skills', order: 40 },
  { kind: 'achievement', label: 'Achievements', order: 50 },
  { kind: 'position', label: 'Positions of Responsibility', order: 60 },
  { kind: 'certification', label: 'Certifications', order: 70 },
  { kind: 'publication', label: 'Publications', order: 80 },
]
