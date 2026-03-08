import { NextResponse } from "next/server";
import { eq, or, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { expenseDebts, users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;

  const rows = db
    .select({
      fromUserId: expenseDebts.fromUserId,
      toUserId: expenseDebts.toUserId,
      amount: expenseDebts.amount,
    })
    .from(expenseDebts)
    .where(
      or(
        eq(expenseDebts.fromUserId, userId),
        eq(expenseDebts.toUserId, userId),
      ),
    )
    .all();

  const netByCounterpart = new Map<number, number>();

  for (const row of rows) {
    if (row.fromUserId === userId) {
      // I owe them
      const counterpart = row.toUserId;
      netByCounterpart.set(
        counterpart,
        (netByCounterpart.get(counterpart) ?? 0) - row.amount,
      );
    } else {
      // They owe me
      const counterpart = row.fromUserId;
      netByCounterpart.set(
        counterpart,
        (netByCounterpart.get(counterpart) ?? 0) + row.amount,
      );
    }
  }

  const counterpartIds = [...netByCounterpart.keys()];
  if (counterpartIds.length === 0) {
    return NextResponse.json({ balances: [] });
  }

  const counterpartUsers = db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(inArray(users.id, counterpartIds))
    .all();

  const userMap = new Map(counterpartUsers.map((u) => [u.id, u]));

  const balances = counterpartIds
    .map((id) => {
      const amount = Math.round((netByCounterpart.get(id) ?? 0) * 100) / 100;
      const user = userMap.get(id);
      if (!user || amount === 0) return null;
      return { user, amount };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .sort((a, b) => a.amount - b.amount);

  return NextResponse.json({ balances });
}
