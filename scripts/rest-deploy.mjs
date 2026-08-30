// REST production deploy (re-brief Arc 5): the Vercel CLI cannot authenticate with a
// team-scoped token (/v2/user is account-only), but the deployments API can. Inlines every
// git-tracked file (minus docs/ — README images, not build inputs) as base64 and polls to READY.
// Token from gitignored .env.local (D109: pulled/stored, never pasted into files).
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const token = /VERCEL_TOKEN=([^\r\n]+)/.exec(env)?.[1]
if (!token) throw new Error('VERCEL_TOKEN missing from .env.local')
const TEAM = 'team_B21vLCIcwNIzaWX26hUkmNLq'
const PROJECT = 'prj_oTE87H2PWVCPyp3vBdkYCWIaUuyd'

const tracked = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .map((s) => s.trim())
  .filter((f) => f && !f.startsWith('docs/'))

const files = tracked.map((f) => ({
  file: f,
  data: readFileSync(f).toString('base64'),
  encoding: 'base64',
}))
console.log(`inlining ${files.length} files (${Math.round(files.reduce((n, f) => n + f.data.length, 0) / 1024)} KB b64)`)

const res = await fetch(`https://api.vercel.com/v13/deployments?teamId=${TEAM}&skipAutoDetectionConfirmation=1`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'sifarish', project: PROJECT, target: 'production', files }),
})
const dep = await res.json()
if (!res.ok) {
  console.error('create failed', res.status, JSON.stringify(dep).slice(0, 500))
  process.exit(1)
}
console.log('deployment created:', dep.id, dep.url, dep.readyState)

const started = Date.now()
for (;;) {
  await new Promise((r) => setTimeout(r, 10000))
  const s = await (
    await fetch(`https://api.vercel.com/v13/deployments/${dep.id}?teamId=${TEAM}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json()
  console.log('state:', s.readyState, Math.round((Date.now() - started) / 1000) + 's')
  if (s.readyState === 'READY') {
    console.log('READY →', s.url, '| aliases:', (s.alias ?? []).join(', '))
    break
  }
  if (s.readyState === 'ERROR' || s.readyState === 'CANCELED') {
    console.error('FAILED:', JSON.stringify(s.errorMessage ?? s).slice(0, 400))
    process.exit(1)
  }
  if (Date.now() - started > 9 * 60 * 1000) {
    console.error('timeout')
    process.exit(1)
  }
}
