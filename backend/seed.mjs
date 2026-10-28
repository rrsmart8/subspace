import { openDatabase } from './database.mjs';
const db = openDatabase();
console.table(db.prepare('SELECT id, tier, cash_bani / 100.0 AS balance_ron FROM accounts ORDER BY tier').all());
db.close();
