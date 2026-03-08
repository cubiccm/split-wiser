"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface User {
  id: number;
  name: string;
  email: string;
}

interface ExpenseEntry {
  user: User;
  amount: number;
}

interface Expense {
  id: number;
  description: string;
  amount: number;
  createdBy: User;
  createdAt: string;
  payers: ExpenseEntry[];
  splits: ExpenseEntry[];
}

interface ExpenseListProps {
  currentUserId: number;
  refreshKey: number;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function NetSummary({
  expense,
  currentUserId,
}: {
  expense: Expense;
  currentUserId: number;
}) {
  const paidAmount =
    expense.payers.find((p) => p.user.id === currentUserId)?.amount ?? 0;
  const owedAmount =
    expense.splits.find((s) => s.user.id === currentUserId)?.amount ?? 0;
  const net = paidAmount - owedAmount;

  if (net > 0) {
    return (
      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
        you lent {formatCurrency(net)}
      </span>
    );
  }
  if (net < 0) {
    return (
      <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
        you owe {formatCurrency(Math.abs(net))}
      </span>
    );
  }
  return <span className="text-muted-foreground text-sm">settled</span>;
}

export function ExpenseList({ currentUserId, refreshKey }: ExpenseListProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpenses = useCallback(async () => {
    try {
      const res = await fetch("/api/expenses");
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses, refreshKey]);

  if (loading) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Loading expenses…
      </p>
    );
  }

  if (expenses.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No expenses yet. Add one to get started.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {expenses.map((expense) => (
        <Card key={expense.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">
                  {expense.description}
                </CardTitle>
                <CardDescription>{timeAgo(expense.createdAt)}</CardDescription>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-base font-semibold">
                  {formatCurrency(expense.amount)}
                </span>
                <NetSummary expense={expense} currentUserId={currentUserId} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Separator className="mb-3" />
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Paid for by
                </span>
                <div className="mt-1 space-y-0.5">
                  {expense.payers.map((p) => (
                    <div
                      key={p.user.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{p.user.name}</span>
                      <span className="text-muted-foreground shrink-0 tabular-nums">
                        {formatCurrency(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Split between
                </span>
                <div className="mt-1 space-y-0.5">
                  {expense.splits.map((s) => (
                    <div
                      key={s.user.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{s.user.name}</span>
                      <span className="text-muted-foreground shrink-0 tabular-nums">
                        {formatCurrency(s.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
