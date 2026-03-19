import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { expenses, expenseDebts } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { settleCycles } from "@/lib/cycle-settlement";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid expense ID" }, { status: 400 });
  }

  const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));

  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  if (expense.createdById !== session.userId) {
    return NextResponse.json(
      { error: "Only the creator can void this expense" },
      { status: 403 },
    );
  }

  if (expense.voidedAt) {
    return NextResponse.json(
      { error: "Expense is already voided" },
      { status: 400 },
    );
  }

  let autoSettlements = 0;

  await db.transaction(async (tx) => {
    await tx
      .update(expenses)
      .set({ voidedAt: new Date() })
      .where(eq(expenses.id, id));

    await tx.delete(expenseDebts).where(eq(expenseDebts.expenseId, id));

    autoSettlements = await settleCycles(tx, session.userId!);
  });

  return NextResponse.json({ success: true, autoSettlements });
}
