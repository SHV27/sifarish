import { buildBookmarklet, buildProfile } from '../src/lib/cockpit/bookmarklet'
const identity = { id: 'me' as const, name: 'Shaurya Verma', email: 'shaurya.verma2705@gmail.com', phone: '+91-9041523296', github: 'github.com/SHV27', linkedin: 'linkedin.com/in/shaurya-verma-94a607329', location: 'Patiala, Punjab, India', headline: 'AI engineer' }
const edu = [{ id: 'e1', kind: 'education' as const, title: 'B.Tech Computer Science & Engineering — Thapar Institute of Engineering & Technology', summary: '', bullets: [], tier: 'shipped' as const, evidence: { date: '05/2027', note: '' }, tags: [], resumeEligible: true }]
const url = buildBookmarklet(buildProfile(identity, edu))
process.stdout.write(decodeURIComponent(url.replace(/^javascript:/, '')))
