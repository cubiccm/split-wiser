/**
 * One-time script to backfill expense_debts for all existing expenses.
 * Run with: npx tsx scripts/backfill-debts.ts
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";

import * as schema from "../src/lib/db/schema";
import { computeDebts } from "../src/lib/debts";

const sqlite = new Database("sqlite.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

const allExpenses = db.select().from(schema.expenses).all();

let backfilled = 0;
let skipped = 0;

for (const expense of allExpenses) {
  const existing = db
    .select({ id: schema.expenseDebts.id })
    .from(schema.expenseDebts)
    .where(eq(schema.expenseDebts.expenseId, expense.id))
    .all();

  if (existing.length > 0) {
    skipped++;
    continue;
  }

  const payers = db
    .select({
      userId: schema.expensePayers.userId,
      amount: schema.expensePayers.amount,
    })
    .from(schema.expensePayers)
    .where(eq(schema.expensePayers.expenseId, expense.id))
    .all();

  const splits = db
    .select({
      userId: schema.expenseSplits.userId,
      amount: schema.expenseSplits.amount,
    })
    .from(schema.expenseSplits)
    .where(eq(schema.expenseSplits.expenseId, expense.id))
    .all();

  const debts = computeDebts(payers, splits);

  db.transaction((tx) => {
    for (const debt of debts) {
      tx.insert(schema.expenseDebts)
        .values({
          expenseId: expense.id,
          fromUserId: debt.fromUserId,
          toUserId: debt.toUserId,
          amount: debt.amount,
        })
        .run();
    }
  });

  backfilled++;
}

console.log(
  `Done. Backfilled ${backfilled} expenses, skipped ${skipped} (already had debts).`,
);

sqlite.close();
