import { NextRequest, NextResponse } from "next/server";
import { eq, inArray, desc, ne, and } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  expenses,
  expenseDebts,
  expensePayers,
  expenseSplits,
  users,
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { computeDebts } from "@/lib/debts";
import { settleCycles } from "@/lib/cycle-settlement";

// ── GET /api/expenses ─────────────────────────────────────────────────
// Returns all expenses where the current user is a payer or participant.

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;

  const payerExpenseIds = db
    .select({ id: expensePayers.expenseId })
    .from(expensePayers)
    .where(eq(expensePayers.userId, userId))
    .all()
    .map((r) => r.id);

  const splitExpenseIds = db
    .select({ id: expenseSplits.expenseId })
    .from(expenseSplits)
    .where(eq(expenseSplits.userId, userId))
    .all()
    .map((r) => r.id);

  const expenseIds = [...new Set([...payerExpenseIds, ...splitExpenseIds])];

  if (expenseIds.length === 0) {
    return NextResponse.json({ expenses: [] });
  }

  const expenseRows = db
    .select()
    .from(expenses)
    .where(
      and(
        inArray(expenses.id, expenseIds),
        ne(expenses.type, "auto_settlement"),
      ),
    )
    .orderBy(desc(expenses.createdAt))
    .all();

  const topLevelIds = expenseRows.map((e) => e.id);

  const autoSettlementRows =
    topLevelIds.length > 0
      ? db
          .select()
          .from(expenses)
          .where(
            and(
              eq(expenses.type, "auto_settlement"),
              inArray(expenses.originExpenseId, topLevelIds),
            ),
          )
          .all()
      : [];

  const autoByOrigin = new Map<number, typeof autoSettlementRows>();
  for (const as of autoSettlementRows) {
    if (!as.originExpenseId) continue;
    const list = autoByOrigin.get(as.originExpenseId) ?? [];
    list.push(as);
    autoByOrigin.set(as.originExpenseId, list);
  }

  function hydrateExpense(expense: (typeof expenseRows)[number]) {
    const payers = db
      .select({
        amount: expensePayers.amount,
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
      })
      .from(expensePayers)
      .innerJoin(users, eq(expensePayers.userId, users.id))
      .where(eq(expensePayers.expenseId, expense.id))
      .all();

    const splits = db
      .select({
        amount: expenseSplits.amount,
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
      })
      .from(expenseSplits)
      .innerJoin(users, eq(expenseSplits.userId, users.id))
      .where(eq(expenseSplits.expenseId, expense.id))
      .all();

    const debtRows = db
      .select({
        amount: expenseDebts.amount,
        fromUserId: expenseDebts.fromUserId,
        toUserId: expenseDebts.toUserId,
      })
      .from(expenseDebts)
      .where(eq(expenseDebts.expenseId, expense.id))
      .all();

    const debtUserIds = [
      ...new Set(debtRows.flatMap((d) => [d.fromUserId, d.toUserId])),
    ];
    const debtUsers =
      debtUserIds.length > 0
        ? db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(inArray(users.id, debtUserIds))
            .all()
        : [];
    const userMap = new Map(debtUsers.map((u) => [u.id, u]));

    const createdBy = db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, expense.createdById))
      .get();

    return {
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      type: expense.type,
      createdBy,
      createdAt: expense.createdAt.toISOString(),
      payers: payers.map((p) => ({
        user: { id: p.userId, name: p.userName, email: p.userEmail },
        amount: p.amount,
      })),
      splits: splits.map((s) => ({
        user: { id: s.userId, name: s.userName, email: s.userEmail },
        amount: s.amount,
      })),
      debts: debtRows.map((d) => ({
        fromUser: userMap.get(d.fromUserId) ?? {
          id: d.fromUserId,
          name: "Unknown",
          email: "",
        },
        toUser: userMap.get(d.toUserId) ?? {
          id: d.toUserId,
          name: "Unknown",
          email: "",
        },
        amount: d.amount,
      })),
    };
  }

  const result = expenseRows.map((expense) => {
    const hydrated = hydrateExpense(expense);

    const childRows = autoByOrigin.get(expense.id) ?? [];
    const visibleChildren = childRows.filter((child) => {
      const isInvolved =
        db
          .select({ id: expensePayers.id })
          .from(expensePayers)
          .where(
            and(
              eq(expensePayers.expenseId, child.id),
              eq(expensePayers.userId, userId),
            ),
          )
          .get() ||
        db
          .select({ id: expenseSplits.id })
          .from(expenseSplits)
          .where(
            and(
              eq(expenseSplits.expenseId, child.id),
              eq(expenseSplits.userId, userId),
            ),
          )
          .get();
      return !!isInvolved;
    });

    return {
      ...hydrated,
      autoSettlements: visibleChildren.map(hydrateExpense),
    };
  });

  return NextResponse.json({ expenses: result });
}

// ── POST /api/expenses ────────────────────────────────────────────────

interface PayerInput {
  userId: number;
  amount: number;
}
interface SplitInput {
  userId: number;
  amount: number;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    description,
    amount,
    payers,
    splits,
    type = "expense",
  }: {
    description: string;
    amount: number;
    payers: PayerInput[];
    splits: SplitInput[];
    type?: "expense" | "settlement";
  } = body;

  if (
    !description?.trim() ||
    typeof amount !== "number" ||
    amount <= 0 ||
    !Array.isArray(payers) ||
    payers.length === 0 ||
    !Array.isArray(splits) ||
    splits.length === 0
  ) {
    return NextResponse.json(
      { error: "Invalid expense data" },
      { status: 400 },
    );
  }

  const payerTotal = payers.reduce((sum, p) => sum + p.amount, 0);
  const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);

  if (Math.abs(payerTotal - amount) > 0.01) {
    return NextResponse.json(
      { error: "Payer amounts must equal the total" },
      { status: 400 },
    );
  }
  if (Math.abs(splitTotal - amount) > 0.01) {
    return NextResponse.json(
      { error: "Split amounts must equal the total" },
      { status: 400 },
    );
  }

  const allUserIds = [
    ...new Set([
      ...payers.map((p) => p.userId),
      ...splits.map((s) => s.userId),
    ]),
  ];
  const existingUsers = db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, allUserIds))
    .all();

  if (existingUsers.length !== allUserIds.length) {
    return NextResponse.json(
      { error: "One or more users not found" },
      { status: 400 },
    );
  }

  const debts = computeDebts(payers, splits);

  const result = db.transaction((tx) => {
    const inserted = tx
      .insert(expenses)
      .values({
        description: description.trim(),
        amount,
        type,
        createdById: session.userId!,
      })
      .returning()
      .get();

    for (const payer of payers) {
      tx.insert(expensePayers)
        .values({
          expenseId: inserted.id,
          userId: payer.userId,
          amount: payer.amount,
        })
        .run();
    }

    for (const split of splits) {
      tx.insert(expenseSplits)
        .values({
          expenseId: inserted.id,
          userId: split.userId,
          amount: split.amount,
        })
        .run();
    }

    for (const debt of debts) {
      tx.insert(expenseDebts)
        .values({
          expenseId: inserted.id,
          fromUserId: debt.fromUserId,
          toUserId: debt.toUserId,
          amount: debt.amount,
        })
        .run();
    }

    return inserted;
  });

  const autoSettlements = settleCycles(session.userId!, result.id);

  return NextResponse.json(
    { expense: result, autoSettlements },
    { status: 201 },
  );
}
