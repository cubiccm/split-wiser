/**
 * One-time script to backfill expense_debts for all existing expenses.
 * Run with: npx tsx scripts/backfill-debts.ts
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";

import * as schema from "../src/lib/db/schema";
import { computeDebts } from "../src/lib/debts";

try {
  process.loadEnvFile(".env.local");
} catch {
  // env vars may already be set
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client, { schema });

const allExpenses = await db.select().from(schema.expenses);

let backfilled = 0;
let skipped = 0;

for (const expense of allExpenses) {
  const existing = await db
    .select({ id: schema.expenseDebts.id })
    .from(schema.expenseDebts)
    .where(eq(schema.expenseDebts.expenseId, expense.id));

  if (existing.length > 0) {
    skipped++;
    continue;
  }

  const payers = await db
    .select({
      userId: schema.expensePayers.userId,
      amount: schema.expensePayers.amount,
    })
    .from(schema.expensePayers)
    .where(eq(schema.expensePayers.expenseId, expense.id));

  const splits = await db
    .select({
      userId: schema.expenseSplits.userId,
      amount: schema.expenseSplits.amount,
    })
    .from(schema.expenseSplits)
    .where(eq(schema.expenseSplits.expenseId, expense.id));

  const debts = computeDebts(payers, splits);

  await db.transaction(async (tx) => {
    for (const debt of debts) {
      await tx.insert(schema.expenseDebts).values({
        expenseId: expense.id,
        fromUserId: debt.fromUserId,
        toUserId: debt.toUserId,
        amount: debt.amount,
      });
    }
  });

  backfilled++;
}

console.log(
  `Done. Backfilled ${backfilled} expenses, skipped ${skipped} (already had debts).`,
);
