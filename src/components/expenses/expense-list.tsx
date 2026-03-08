"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

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

interface DebtEntry {
  fromUser: User;
  toUser: User;
  amount: number;
}

interface AutoSettlement {
  id: number;
  description: string;
  amount: number;
  type: "auto_settlement";
  createdBy: User;
  createdAt: string;
  payers: ExpenseEntry[];
  splits: ExpenseEntry[];
  debts: DebtEntry[];
}

interface Expense {
  id: number;
  description: string;
  amount: number;
  type: "expense" | "settlement" | "auto_settlement";
  createdBy: User;
  createdAt: string;
  payers: ExpenseEntry[];
  splits: ExpenseEntry[];
  debts: DebtEntry[];
  autoSettlements: AutoSettlement[];
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
  const youOwe = expense.debts.filter((d) => d.fromUser.id === currentUserId);
  const owedToYou = expense.debts.filter((d) => d.toUser.id === currentUserId);

  if (youOwe.length === 0 && owedToYou.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      {owedToYou.map((d) => (
        <span
          key={d.fromUser.id}
          className="text-sm font-medium text-emerald-600 dark:text-emerald-400"
        >
          You lent {d.fromUser.name} {formatCurrency(d.amount)}
        </span>
      ))}
      {youOwe.map((d) => (
        <span
          key={d.toUser.id}
          className="text-sm font-medium text-orange-600 dark:text-orange-400"
        >
          You owe {d.toUser.name} {formatCurrency(d.amount)}
        </span>
      ))}
    </div>
  );
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
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="truncate text-base">
                    {expense.description}
                  </CardTitle>
                  {expense.type === "settlement" && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      Settlement
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  {expense.createdBy.name} &middot; {timeAgo(expense.createdAt)}
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-base font-semibold">
                  {formatCurrency(expense.amount)}
                </span>
                {expense.type === "expense" && (
                  <NetSummary expense={expense} currentUserId={currentUserId} />
                )}
              </div>
            </div>
          </CardHeader>

          {expense.type === "expense" && (
            <CardContent>
              <Separator className="mb-3" />
              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {expense.splits.length === 1 ? "Owed by" : "Split between"}
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
              </div>
            </CardContent>
          )}

          {expense.autoSettlements.length > 0 && (
            <CardContent>
              {expense.type === "expense" ? null : (
                <Separator className="mb-3" />
              )}
              <div className="space-y-1.5">
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Auto-settlements
                </span>
                {expense.autoSettlements.map((as) => (
                  <div
                    key={as.id}
                    className="text-muted-foreground flex items-center gap-1.5 text-xs"
                  >
                    <span className="font-medium text-violet-600 dark:text-violet-400">
                      {as.payers[0]?.user.name ?? "Unknown"}
                    </span>
                    <ArrowRight className="size-3 shrink-0" />
                    <span className="font-medium text-violet-600 dark:text-violet-400">
                      {as.splits[0]?.user.name ?? "Unknown"}
                    </span>
                    <span className="ml-auto shrink-0 tabular-nums">
                      {formatCurrency(as.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
