// Provide an in-memory IndexedDB for DB-backed tests (budgets, sweep merge).
// Imported before any module that opens Dexie, so `db` binds to the fake.
import 'fake-indexeddb/auto'

// PEHCHAAN (Session 5) resolves the mode SYNCHRONOUSLY from localStorage at module load and
// freezes it for the process. So the test suite must look like an unlocked OWNER *before* any
// src module (which pulls in pehchaan → db) is imported. We install a localStorage polyfill and
// set the owner-unlock flag + a token here, at the very top, ahead of every src import below.
class MemStorage {
  private m = new Map<string, string>()
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v))
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
  get length() {
    return this.m.size
  }
}
const g = globalThis as Record<string, unknown>
if (!g.localStorage) g.localStorage = new MemStorage()
if (!g.sessionStorage) g.sessionStorage = new MemStorage()
localStorage.setItem('sifarish.darbaan.unlocked', '1')
localStorage.setItem('sifarish.apitoken', 'test-token')
