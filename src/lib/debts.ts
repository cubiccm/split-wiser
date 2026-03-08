export interface DebtEntry {
  fromUserId: number;
  toUserId: number;
  amount: number;
}

/**
 * Given payers and splits for an expense, compute the minimal set of
 * transfers (debts) needed to settle up.
 *
 * Algorithm:
 * 1. Compute each user's net = sum(paid) - sum(owed).
 * 2. Positive-net users are creditors; negative-net users are debtors.
 * 3. Greedily match the largest debtor to the largest creditor until all
 *    balances are zero.
 */
export function computeDebts(
  payers: { userId: number; amount: number }[],
  splits: { userId: number; amount: number }[],
): DebtEntry[] {
  const netByUser = new Map<number, number>();

  for (const p of payers) {
    netByUser.set(p.userId, (netByUser.get(p.userId) ?? 0) + p.amount);
  }
  for (const s of splits) {
    netByUser.set(s.userId, (netByUser.get(s.userId) ?? 0) - s.amount);
  }

  const creditors: { userId: number; amount: number }[] = [];
  const debtors: { userId: number; amount: number }[] = [];

  for (const [userId, net] of netByUser) {
    const rounded = Math.round(net * 100) / 100;
    if (rounded > 0) {
      creditors.push({ userId, amount: rounded });
    } else if (rounded < 0) {
      debtors.push({ userId, amount: -rounded });
    }
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const debts: DebtEntry[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const transfer =
      Math.round(Math.min(creditors[ci].amount, debtors[di].amount) * 100) /
      100;
    if (transfer > 0) {
      debts.push({
        fromUserId: debtors[di].userId,
        toUserId: creditors[ci].userId,
        amount: transfer,
      });
    }
    creditors[ci].amount =
      Math.round((creditors[ci].amount - transfer) * 100) / 100;
    debtors[di].amount =
      Math.round((debtors[di].amount - transfer) * 100) / 100;

    if (creditors[ci].amount === 0) ci++;
    if (debtors[di].amount === 0) di++;
  }

  return debts;
}
