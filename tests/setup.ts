// Provide an in-memory IndexedDB for DB-backed tests (budgets, sweep merge).
// Imported before any module that opens Dexie, so `db` binds to the fake.
import 'fake-indexeddb/auto'

// Darbaan (v4): the test suite runs as the OWNER by default — every suite exercises the
// unlocked app. Darshak-mode blocking has its own dedicated tests (darbaan.test.ts) which
// lock/unlock explicitly.
import { setPasscode } from '../src/lib/darbaan/lock'
await setPasscode('test-owner')
