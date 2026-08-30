import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../api/khabri/jobs'

/**
 * Re-brief — /search-v2 support, driven through the REAL handler (D55 law: test what the
 * client actually sends). v2 shape measured live 30-Aug-2026: { data: { jobs: [...], cursor } }.
 */

const V2_BODY = {
  status: 'OK',
  data: {
    jobs: [
      {
        job_id: 'abc123',
        job_title: 'AI Engineer Intern',
        employer_name: 'Netomi',
        job_publisher: 'LinkedIn',
        job_apply_link: 'https://example.com/apply',
        job_description: 'Build agents.',
        job_is_remote: true,
        job_country: 'IN',
      },
    ],
    cursor: 'CURSOR_TOKEN_1',
  },
}
const LEGACY_BODY = { status: 'OK', data: [V2_BODY.data.jobs[0]] }

function req(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/khabri/jobs', {
    method: 'POST',
    headers: { origin: 'http://localhost', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('JSearch /search-v2 (server)', () => {
  const realFetch = globalThis.fetch
  let lastUrl = ''
  beforeEach(() => {
    process.env.JSEARCH_API_KEY = 'test-key'
    delete process.env.SIFARISH_OWNER_PASSCODE
    delete process.env.SIFARISH_OWNER_TOKEN
  })
  afterEach(() => {
    globalThis.fetch = realFetch
    delete process.env.JSEARCH_API_KEY
    delete process.env.JSEARCH_PATH
  })

  const mockProvider = (payload: unknown) => {
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      lastUrl = String(url)
      return new Response(JSON.stringify(payload), { status: 200 })
    }) as unknown as typeof fetch
  }

  it('v2 path: extracts data.jobs, returns nextCursor, sends cursor (not page) on depth', async () => {
    process.env.JSEARCH_PATH = '/jsearch/search-v2'
    mockProvider(V2_BODY)
    const r1 = await (await handler(req({ query: 'AI engineer intern' }))).json()
    expect(r1.jobs).toHaveLength(1)
    expect(r1.jobs[0].id).toBe('jsearch:abc123')
    expect(r1.nextCursor).toBe('CURSOR_TOKEN_1')
    expect(lastUrl).not.toContain('page=')

    await handler(req({ query: 'AI engineer intern', page: 2, cursor: 'CURSOR_TOKEN_1' }))
    expect(lastUrl).toContain('cursor=CURSOR_TOKEN_1')
    expect(lastUrl).not.toContain('page=2')
  })

  it('legacy path: array shape still parses, page param still rides, no cursor emitted', async () => {
    mockProvider(LEGACY_BODY)
    const r = await (await handler(req({ query: 'AI engineer intern', page: 2 }))).json()
    expect(r.jobs).toHaveLength(1)
    expect(r.nextCursor).toBeUndefined()
    expect(lastUrl).toContain('page=2')
    expect(lastUrl).toContain('/jsearch/search?')
  })
})
