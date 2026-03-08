"use client";

import { useCallback, useEffect, useState } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

interface User {
  id: number;
  name: string;
  email: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
        <p className="text-sm text-muted-foreground">Loading…</p>
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
    <div className="flex min-h-svh items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {user.name}
        </h1>
        <p className="text-muted-foreground">
          Signed in as {user.email}
        </p>
        <Button variant="outline" onClick={handleLogout}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
