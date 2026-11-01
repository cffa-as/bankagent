// Prepares the film-only SQLite ledger. Run once against a freshly seeded database while the
// API is stopped. It only changes the synthetic opening balance of the demo account; every later
// state change in the film goes through the Go API.
import { DatabaseSync } from 'node:sqlite'

export const FILM_OPENING_BALANCE_MINOR = 2_100_000

const databasePath = process.argv[2]
if (!databasePath || !databasePath.startsWith('/tmp/')) {
  console.error('usage: node scripts/film-ledger.mjs /tmp/<film>.db')
  process.exit(1)
}

const db = new DatabaseSync(databasePath)
const actions = db.prepare('SELECT COUNT(*) AS n FROM actions').get().n
const account = db.prepare("SELECT balance_minor, reserved_minor FROM accounts WHERE id = 'acct_demo'").get()
if (!account) {
  console.error('acct_demo not found; start the API once so it seeds the database')
  process.exit(1)
}
if (actions > 0 || account.reserved_minor !== 0) {
  console.error('refusing to modify a ledger that already has actions or reservations')
  process.exit(1)
}
db.prepare("UPDATE accounts SET balance_minor = ? WHERE id = 'acct_demo'").run(FILM_OPENING_BALANCE_MINOR)
db.close()
console.log(`film ledger opening balance: ${account.balance_minor} -> ${FILM_OPENING_BALANCE_MINOR}`)
