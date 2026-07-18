/**
 * Session 7 (WS-R2) — bullet-level redundancy detection (¶blt-no-duplicated-fact).
 *
 * The owner's real résumé rendered two bullets making the same claim in different words —
 * and the selection path had NO similarity primitive at all (the only Jaccard in the repo
 * was letter-scoped). This is the shared, deterministic overlap measure the compiler's
 * selector and the Editor's Desk both use: stemmed content-word Jaccard, so morphological
 * variants (compile/compiled/compiles) count as the same word.
 */

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'so', 'that', 'this', 'these', 'those', 'with', 'without',
  'for', 'from', 'into', 'onto', 'over', 'under', 'of', 'in', 'on', 'at', 'to', 'by', 'as', 'is',
  'are', 'was', 'were', 'be', 'been', 'its', 'it', 'their', 'his', 'her', 'my', 'our', 'your',
  'every', 'each', 'any', 'all', 'no', 'not', 'never', 'always', 'can', 'could', 'will', 'would',
  'has', 'have', 'had', 'using', 'used', 'use', 'via', 'per', 'both', 'than', 'then', 'when',
  'where', 'which', 'who', 'whose', 'what', 'how', 'end', 'ensuring', 'ensure', 'ensures',
])

/** Light stemmer: strips common suffixes, then a trailing 'e', so morphological variants
 *  collide on one stem: compiled/compiles/compile→compil, pipelines/pipeline→pipelin,
 *  guaranteed/guarantee→guarante, features/feature→featur. */
export function stem(w: string): string {
  let s = w
  for (const suf of ['ations', 'ation', 'ingly', 'ings', 'ing', 'edly', 'ed', 's', 'ly']) {
    if (s.length - suf.length >= 4 && s.endsWith(suf)) {
      s = s.slice(0, -suf.length)
      break
    }
  }
  if (s.length > 4 && s.endsWith('e')) s = s.slice(0, -1)
  return s
}

export function contentStems(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9+#&\s-]/g, ' ')
    .split(/[\s/-]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
  return new Set(words.map(stem))
}

/**
 * Overlap in [0,1]: Jaccard over stemmed content words, biased toward the SHORTER bullet
 * (containment): a short bullet fully restating part of a longer one is redundancy even
 * when the longer one has extra words.
 */
export function bulletOverlap(a: string, b: string): number {
  const sa = contentStems(a)
  const sb = contentStems(b)
  if (sa.size === 0 || sb.size === 0) return 0
  let inter = 0
  for (const w of sa) if (sb.has(w)) inter += 1
  const jaccard = inter / (sa.size + sb.size - inter)
  const containment = inter / Math.min(sa.size, sb.size)
  return Math.max(jaccard, containment * 0.85)
}

/** A pair above this is the same claim wearing different words — never both on one page. */
export const HARD_DUPLICATE = 0.6
/** MMR redundancy weight: how strongly overlap with already-chosen bullets repels a candidate. */
export const REDUNDANCY_WEIGHT = 6
