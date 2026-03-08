"use client";

import { useCallback, useEffect, useState } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { ExpenseList } from "@/components/expenses/expense-list";

interface User {
  id: number;
  name: string;
  email: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

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
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">SplitWiser</h1>
          <p className="text-muted-foreground truncate text-sm">{user.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Sign out
        </Button>
      </header>

      <div className="mt-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium">Expenses</h2>
        <AddExpenseDialog
          currentUser={user}
          onCreated={() => setRefreshKey((k) => k + 1)}
        />
      </div>

      <div className="mt-4">
        <ExpenseList currentUserId={user.id} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
