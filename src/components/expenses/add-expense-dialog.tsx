"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { UserSearch } from "@/components/expenses/user-search";

interface User {
  id: number;
  name: string;
  email: string;
}

interface AddExpenseDialogProps {
  currentUser: User;
  onCreated: () => void;
}

export function AddExpenseDialog({
  currentUser,
  onCreated,
}: AddExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [cents, setCents] = useState(0);
  const [payers, setPayers] = useState<User[]>([currentUser]);
  const [participants, setParticipants] = useState<User[]>([currentUser]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reset = useCallback(() => {
    setDescription("");
    setCents(0);
    setPayers([currentUser]);
    setParticipants([currentUser]);
    setError("");
  }, [currentUser]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const totalAmount = cents / 100;
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    if (isNaN(totalAmount) || totalAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (payers.length === 0) {
      setError("Select at least one payer");
      return;
    }
    if (participants.length === 0) {
      setError("Select at least one participant");
      return;
    }

    const payerAmount = Math.round((totalAmount / payers.length) * 100) / 100;
    const splitAmount =
      Math.round((totalAmount / participants.length) * 100) / 100;

    // Adjust rounding so totals match exactly
    const payerEntries = payers.map((u, i) => ({
      userId: u.id,
      amount:
        i === payers.length - 1
          ? Math.round(
              (totalAmount - payerAmount * (payers.length - 1)) * 100,
            ) / 100
          : payerAmount,
    }));

    const splitEntries = participants.map((u, i) => ({
      userId: u.id,
      amount:
        i === participants.length - 1
          ? Math.round(
              (totalAmount - splitAmount * (participants.length - 1)) * 100,
            ) / 100
          : splitAmount,
    }));

    setSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          amount: totalAmount,
          payers: payerEntries,
          splits: splitEntries,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create expense");
        return;
      }

      setOpen(false);
      reset();
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) reset();
      }}
    >
      <DialogTrigger render={<Button size="lg" />}>
        <Plus className="size-4" />
        Add Expense
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Expense</DialogTitle>
            <DialogDescription>
              Add an expense and split it with others.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <Input
                id="description"
                placeholder="Dinner, groceries, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="amount" className="text-sm font-medium">
                Total amount
              </label>
              <Input
                id="amount"
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
                className="h-20 border-0 text-center text-5xl! font-semibold focus-visible:ring-0"
              />
            </div>

            <UserSearch
              label="Split between"
              selected={participants}
              onSelect={setParticipants}
            />

            <UserSearch
              label="Paid for by"
              selected={payers}
              onSelect={setPayers}
            />

            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
