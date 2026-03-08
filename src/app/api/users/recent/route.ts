import { NextResponse } from "next/server";
import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { expensePayers, expenses, expenseSplits, users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;

  const payerExpenseIds = db
    .selectDistinct({ id: expensePayers.expenseId })
    .from(expensePayers)
    .where(eq(expensePayers.userId, userId))
    .all();

  const splitExpenseIds = db
    .selectDistinct({ id: expenseSplits.expenseId })
    .from(expenseSplits)
    .where(eq(expenseSplits.userId, userId))
    .all();

  const allExpenseIds = [
    ...new Set([
      ...payerExpenseIds.map((r) => r.id),
      ...splitExpenseIds.map((r) => r.id),
    ]),
  ];

  if (allExpenseIds.length === 0) {
    return NextResponse.json({ users: [] });
  }

  const payerContacts = db
    .select({
      userId: expensePayers.userId,
      lastInteraction: sql<number>`max(${expenses.createdAt})`,
    })
    .from(expensePayers)
    .innerJoin(expenses, eq(expensePayers.expenseId, expenses.id))
    .where(
      and(
        inArray(expensePayers.expenseId, allExpenseIds),
        ne(expensePayers.userId, userId),
      ),
    )
    .groupBy(expensePayers.userId)
    .all();

  const splitContacts = db
    .select({
      userId: expenseSplits.userId,
      lastInteraction: sql<number>`max(${expenses.createdAt})`,
    })
    .from(expenseSplits)
    .innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
    .where(
      and(
        inArray(expenseSplits.expenseId, allExpenseIds),
        ne(expenseSplits.userId, userId),
      ),
    )
    .groupBy(expenseSplits.userId)
    .all();

  const contactMap = new Map<number, number>();
  for (const c of [...payerContacts, ...splitContacts]) {
    const ts = c.lastInteraction ?? 0;
    const existing = contactMap.get(c.userId) ?? 0;
    if (ts > existing) {
      contactMap.set(c.userId, ts);
    }
  }

  const sortedContactIds = [...contactMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  if (sortedContactIds.length === 0) {
    return NextResponse.json({ users: [] });
  }

  const contactUsers = db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(inArray(users.id, sortedContactIds))
    .all();

  const userMap = new Map(contactUsers.map((u) => [u.id, u]));
  const orderedResults = sortedContactIds
    .filter((id) => userMap.has(id))
    .map((id) => userMap.get(id)!);

  return NextResponse.json({ users: orderedResults });
}
