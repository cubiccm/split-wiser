"use client";

import { useCallback, useEffect, useState } from "react";
import { PlusIcon, Scale } from "lucide-react";

import { Button } from "@/components/ui/button";

interface User {
  id: number;
  name: string;
  email: string;
}

interface Balance {
  user: User;
  amount: number;
}

interface BalanceListProps {
  refreshKey: number;
  onSettle: (counterpart: User, amount: number) => void;
  onAddExpense: (counterpart: User) => void;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function BalanceList({
  refreshKey,
  onSettle,
  onAddExpense,
}: BalanceListProps) {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBalances = useCallback(async () => {
    try {
      const res = await fetch("/api/balances");
      if (res.ok) {
        const data = await res.json();
        setBalances(data.balances);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances, refreshKey]);

  if (loading) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        Loading balances…
      </p>
    );
  }

  if (balances.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        No outstanding balances.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {balances.map((b) => (
        <div
          key={b.user.id}
          className="flex flex-col items-stretch justify-between gap-3 rounded-lg border px-4 py-3 lg:flex-row lg:items-center"
        >
          <div className="min-w-0">
            <p className="truncate text-sm">
              <span className="font-medium">{b.user.name}</span>{" "}
              <span className="text-muted-foreground">{b.user.email}</span>
            </p>
            {b.amount > 0 ? (
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                owes you {formatCurrency(b.amount)}
              </p>
            ) : (
              <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                you owe {formatCurrency(Math.abs(b.amount))}
              </p>
            )}
          </div>
          <div className="flex shrink-0 justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddExpense(b.user)}
              className="flex flex-1"
            >
              <PlusIcon className="size-3.5" />
              Expense
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSettle(b.user, b.amount)}
              className="flex flex-1"
            >
              <Scale className="size-3.5" />
              Settle
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
