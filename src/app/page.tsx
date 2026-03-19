"use client";

import { useCallback, useEffect, useState } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { BalanceList } from "@/components/balances/balance-list";
import { BouncingTitle } from "@/components/bouncing-title";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { SettleUpDialog } from "@/components/expenses/settle-up-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExpenseList } from "@/components/expenses/expense-list";
import { ChevronDownIcon, LogOutIcon } from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [settleOpen, setSettleOpen] = useState(false);
  const [settleCounterpart, setSettleCounterpart] = useState<User | null>(null);
  const [settleBalance, setSettleBalance] = useState(0);

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [expenseCounterpart, setExpenseCounterpart] = useState<User | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const handleSettle = useCallback((counterpart: User, balance: number) => {
    setSettleCounterpart(counterpart);
    setSettleBalance(balance);
    setSettleOpen(true);
  }, []);

  const handleAddExpense = useCallback((counterpart: User) => {
    setExpenseCounterpart(counterpart);
    setExpenseDialogOpen(true);
  }, []);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <AuthCard onSuccess={setUser} />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-svh max-w-2xl px-4 py-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <BouncingTitle text="Split Wiser" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="focus-visible:ring-ring hover:bg-muted data-[state=open]:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition-colors focus-visible:ring-2 focus-visible:outline-none">
            <div className="flex flex-col items-end">
              <p className="truncate text-base font-medium">{user.name}</p>
              <p className="text-muted-foreground truncate text-sm">
                {user.email}
              </p>
            </div>
            <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleLogout}>
              <LogOutIcon className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="mt-6">
        <h2 className="text-lg font-medium">Balances</h2>
        <div className="mt-2">
          <BalanceList
            refreshKey={refreshKey}
            onSettle={handleSettle}
            onAddExpense={handleAddExpense}
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium">Activities</h2>
        <AddExpenseDialog currentUser={user} onCreated={refresh} />
      </div>

      <div className="mt-4">
        <ExpenseList
          currentUserId={user.id}
          refreshKey={refreshKey}
          onRefresh={refresh}
        />
      </div>

      {settleCounterpart && (
        <SettleUpDialog
          open={settleOpen}
          onOpenChange={setSettleOpen}
          currentUser={user}
          counterpart={settleCounterpart}
          balance={settleBalance}
          onSettled={refresh}
        />
      )}

      {expenseCounterpart && (
        <AddExpenseDialog
          currentUser={user}
          onCreated={refresh}
          open={expenseDialogOpen}
          onOpenChange={setExpenseDialogOpen}
          initialParticipants={[user, expenseCounterpart]}
        />
      )}
    </div>
  );
}
