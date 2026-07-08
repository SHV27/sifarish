// Provide an in-memory IndexedDB for DB-backed tests (budgets, sweep merge).
// Imported before any module that opens Dexie, so `db` binds to the fake.
import 'fake-indexeddb/auto'
