"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface User {
  id: number;
  name: string;
  email: string;
}

interface SettleUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: User;
  /** The other user in the settlement */
  counterpart: User;
  /**
   * Signed balance from current user's perspective:
   * positive = counterpart owes you, negative = you owe counterpart.
   */
  balance: number;
  onSettled: () => void;
}

export function SettleUpDialog({
  open,
  onOpenChange,
  currentUser,
  counterpart,
  balance,
  onSettled,
}: SettleUpDialogProps) {
  const [cents, setCents] = useState(() => Math.round(Math.abs(balance) * 100));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const youOwe = balance < 0;
  const amount = cents / 100;

  useEffect(() => {
    setCents(Math.round(Math.abs(balance) * 100));
  }, [balance]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (cents <= 0) {
      setError("Enter a valid amount");
      return;
    }

    const payers = youOwe
      ? [{ userId: currentUser.id, amount }]
      : [{ userId: counterpart.id, amount }];
    const splits = youOwe
      ? [{ userId: counterpart.id, amount }]
      : [{ userId: currentUser.id, amount }];

    setSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: youOwe
            ? `${currentUser.name} paid ${counterpart.name}`
            : `${counterpart.name} paid ${currentUser.name}`,
          originalAmountCents: cents,
          cashbackRate: 0,
          type: "settlement",
          payers,
          splits,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create settlement");
        return;
      }

      if (data.autoSettlements > 0) {
        toast.info("Debt cycle detected and auto-settled");
      }

      onSettled();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Settle Up</DialogTitle>
            <DialogDescription>
              {youOwe
                ? `Record a payment to ${counterpart.name}`
                : `Record a payment from ${counterpart.name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="settle-amount" className="text-sm font-medium">
                Amount
              </label>
              <Input
                id="settle-amount"
                type="text"
                inputMode="decimal"
                value={(cents / 100).toFixed(2)}
                onKeyDown={(e) => {
                  e.preventDefault();
                  if (e.key >= "0" && e.key <= "9") {
                    setCents((prev) => prev * 10 + Number(e.key));
                  } else if (e.key === "Backspace") {
                    setCents((prev) => Math.floor(prev / 10));
                  }
                }}
                onChange={() => {}}
                className="h-16 border-0 text-center text-4xl! font-semibold focus-visible:ring-0"
              />
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Recording…" : "Record Settlement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
