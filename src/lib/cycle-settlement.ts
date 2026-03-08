import { inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  expenses,
  expenseDebts,
  expensePayers,
  expenseSplits,
  users,
} from "@/lib/db/schema";

type Graph = Map<number, Map<number, number>>;

/**
 * Build a global net-debt directed graph from all expense_debts rows.
 * graph.get(A)?.get(B) = net amount A owes B (only positive values stored).
 * Opposite directions are netted out so no 2-node cycles can exist.
 */
async function buildNetDebtGraph(): Promise<Graph> {
  const rows = await db
    .select({
      fromUserId: expenseDebts.fromUserId,
      toUserId: expenseDebts.toUserId,
      amount: expenseDebts.amount,
    })
    .from(expenseDebts);

  const pairNet = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.fromUserId}-${row.toUserId}`;
    pairNet.set(key, (pairNet.get(key) ?? 0) + row.amount);
  }

  const graph: Graph = new Map();
  const processed = new Set<string>();

  for (const [key, amount] of pairNet) {
    if (processed.has(key)) continue;

    const sep = key.indexOf("-");
    const a = parseInt(key.slice(0, sep));
    const b = parseInt(key.slice(sep + 1));
    const reverseKey = `${b}-${a}`;
    processed.add(key);
    processed.add(reverseKey);

    const net =
      Math.round((amount - (pairNet.get(reverseKey) ?? 0)) * 100) / 100;
    if (net > 0) {
      if (!graph.has(a)) graph.set(a, new Map());
      graph.get(a)!.set(b, net);
    } else if (net < 0) {
      if (!graph.has(b)) graph.set(b, new Map());
      graph.get(b)!.set(a, -net);
    }
  }

  return graph;
}

/**
 * DFS-based cycle detection. Returns the cycle as [u0, u1, ..., un]
 * where u0→u1→...→un→u0, or null if no cycle exists.
 */
function findCycle(graph: Graph): number[] | null {
  const visited = new Set<number>();
  const inStack = new Set<number>();
  const path: number[] = [];

  function dfs(node: number): number[] | null {
    visited.add(node);
    inStack.add(node);
    path.push(node);

    const neighbors = graph.get(node);
    if (neighbors) {
      for (const [next, weight] of neighbors) {
        if (weight <= 0) continue;

        if (!visited.has(next)) {
          const result = dfs(next);
          if (result) return result;
        } else if (inStack.has(next)) {
          const cycleStart = path.indexOf(next);
          return path.slice(cycleStart);
        }
      }
    }

    path.pop();
    inStack.delete(node);
    return null;
  }

  const allNodes = new Set<number>();
  for (const [from, neighbors] of graph) {
    allNodes.add(from);
    for (const [to] of neighbors) {
      allNodes.add(to);
    }
  }

  for (const node of allNodes) {
    if (!visited.has(node)) {
      const result = dfs(node);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Detect and settle all cycles in the global debt graph.
 * Returns the total number of auto-settlement records created.
 *
 * For each cycle found, the bottleneck (min edge weight) is subtracted
 * from every edge by inserting reverse debt entries as settlement expenses.
 */
export async function settleCycles(
  createdById: number,
  originExpenseId: number,
): Promise<number> {
  const MAX_ITERATIONS = 100;
  let totalRecords = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const graph = await buildNetDebtGraph();
    const cycle = findCycle(graph);
    if (!cycle) break;

    let bottleneck = Infinity;
    for (let j = 0; j < cycle.length; j++) {
      const from = cycle[j];
      const to = cycle[(j + 1) % cycle.length];
      const weight = graph.get(from)?.get(to) ?? 0;
      bottleneck = Math.min(bottleneck, weight);
    }
    bottleneck = Math.round(bottleneck * 100) / 100;
    if (bottleneck <= 0) break;

    const nameRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, cycle));
    const nameMap = new Map(nameRows.map((u) => [u.id, u.name]));

    await db.transaction(async (tx) => {
      for (let j = 0; j < cycle.length; j++) {
        const from = cycle[j];
        const to = cycle[(j + 1) % cycle.length];
        const fromName = nameMap.get(from) ?? "Unknown";
        const toName = nameMap.get(to) ?? "Unknown";

        const [inserted] = await tx
          .insert(expenses)
          .values({
            description: `Auto-settlement: ${fromName} paid ${toName}`,
            amount: bottleneck,
            type: "auto_settlement",
            originExpenseId,
            createdById,
          })
          .returning();

        await tx.insert(expensePayers).values({
          expenseId: inserted.id,
          userId: from,
          amount: bottleneck,
        });

        await tx.insert(expenseSplits).values({
          expenseId: inserted.id,
          userId: to,
          amount: bottleneck,
        });

        await tx.insert(expenseDebts).values({
          expenseId: inserted.id,
          fromUserId: to,
          toUserId: from,
          amount: bottleneck,
        });
      }
    });

    totalRecords += cycle.length;
  }

  return totalRecords;
}
