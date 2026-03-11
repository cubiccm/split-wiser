"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UserSelect } from "@/components/expenses/user-select";

interface User {
  id: number;
  name: string;
  email: string;
}

interface AddExpenseDialogProps {
  currentUser: User;
  onCreated: () => void;
  initialParticipants?: User[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function buildEntries(
  users: User[],
  totalAmount: number,
  evenSplit: boolean,
  customAmounts: Record<number, number>,
  sharedCents: number = 0,
): { userId: number; amount: number }[] {
  if (evenSplit || users.length <= 1) {
    const perUser = Math.round((totalAmount / users.length) * 100) / 100;
    return users.map((u, i) => ({
      userId: u.id,
      amount:
        i === users.length - 1
          ? Math.round((totalAmount - perUser * (users.length - 1)) * 100) / 100
          : perUser,
    }));
  }

  const sharedPerUser = Math.floor(sharedCents / users.length);
  const sharedRemainder = sharedCents - sharedPerUser * users.length;

  return users.map((u, i) => ({
    userId: u.id,
    amount:
      Math.round(
        (customAmounts[u.id] ?? 0) +
          sharedPerUser +
          (i < sharedRemainder ? 1 : 0),
      ) / 100,
  }));
}

function validateCustomTotal(
  users: User[],
  totalAmount: number,
  customAmounts: Record<number, number>,
  sharedCents: number = 0,
): string | null {
  const customTotalDollars =
    Math.round(
      users.reduce((sum, u) => sum + (customAmounts[u.id] ?? 0), 0) +
        sharedCents,
    ) / 100;
  if (Math.abs(customTotalDollars - totalAmount) > 0.01) {
    return `Split amounts ($${customTotalDollars.toFixed(2)}) must equal the total ($${totalAmount.toFixed(2)})`;
  }
  return null;
}

export function AddExpenseDialog({
  currentUser,
  onCreated,
  initialParticipants,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: AddExpenseDialogProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = isControlled ? controlledOpen : internalOpen;
  const prevDialogOpen = useRef(false);

  const setDialogOpen = useCallback(
    (next: boolean) => {
      if (isControlled) controlledOnOpenChange?.(next);
      else setInternalOpen(next);
    },
    [isControlled, controlledOnOpenChange],
  );

  const [description, setDescription] = useState("");
  const [cents, setCents] = useState(0);

  const [payers, setPayers] = useState<User[]>([]);
  const [payerEvenSplit, setPayerEvenSplit] = useState(true);
  const [payerAmounts, setPayerAmounts] = useState<Record<number, number>>({});

  const [participants, setParticipants] = useState<User[]>([]);
  const [splitEvenSplit, setSplitEvenSplit] = useState(true);
  const [splitAmounts, setSplitAmounts] = useState<Record<number, number>>({});
  const [splitSharedCents, setSplitSharedCents] = useState(0);

  const [cashbackRate, setCashbackRate] = useState(0);

  const cashbackCents =
    cashbackRate > 0 ? Math.round((cents * cashbackRate) / 100) : 0;
  const effectiveCents = cents - cashbackCents;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<
      Record<
        | "description"
        | "amount"
        | "payers"
        | "participants"
        | "payersSplit"
        | "participantsSplit",
        string
      >
    >
  >({});

  const reset = useCallback(() => {
    setDescription("");
    setCents(0);
    setCashbackRate(0);
    setPayers([]);
    setPayerEvenSplit(true);
    setPayerAmounts({});
    setParticipants([]);
    setSplitEvenSplit(true);
    setSplitAmounts({});
    setSplitSharedCents(0);
    setError("");
    setFieldErrors({});
  }, []);

  useEffect(() => {
    if (dialogOpen && !prevDialogOpen.current) {
      reset();
      if (initialParticipants?.length) {
        setParticipants(initialParticipants);
      }
    }
    prevDialogOpen.current = dialogOpen;
  }, [dialogOpen, reset, initialParticipants]);

  function pruneAmounts(
    users: User[],
    prev: Record<number, number>,
  ): Record<number, number> {
    const next: Record<number, number> = {};
    for (const u of users) {
      next[u.id] = prev[u.id] ?? 0;
    }
    return next;
  }

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const totalAmount = effectiveCents / 100;
    const errors: typeof fieldErrors = {};

    if (!description.trim()) errors.description = "Description is required";
    if (isNaN(totalAmount) || totalAmount <= 0)
      errors.amount = "Enter a valid amount";
    if (payers.length === 0) errors.payers = "Select at least one payer";
    if (participants.length === 0)
      errors.participants = "Select at least one participant";

    if (!payerEvenSplit && payers.length > 1) {
      const err = validateCustomTotal(payers, totalAmount, payerAmounts);
      if (err) errors.payersSplit = err;
    }
    if (!splitEvenSplit && participants.length > 1) {
      const err = validateCustomTotal(
        participants,
        totalAmount,
        splitAmounts,
        splitSharedCents,
      );
      if (err) errors.participantsSplit = err;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const payerEntries = buildEntries(
      payers,
      totalAmount,
      payerEvenSplit,
      payerAmounts,
    );
    const splitEntries = buildEntries(
      participants,
      totalAmount,
      splitEvenSplit,
      splitAmounts,
      splitSharedCents,
    );

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

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create expense");
        return;
      }

      if (data.autoSettlements > 0) {
        toast.info("Debt cycle detected and auto-settled");
      }

      setDialogOpen(false);
      reset();
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!isControlled && (
        <DialogTrigger render={<Button size="lg" />}>
          <Plus className="size-4" />
          Add Expense
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
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
                aria-invalid={!!fieldErrors.description || undefined}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (fieldErrors.description) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.description;
                      return next;
                    });
                  }
                }}
              />
              {fieldErrors.description && (
                <p className="text-destructive text-xs">
                  {fieldErrors.description}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="amount" className="text-sm font-medium">
                Total amount
              </label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                value={(cents / 100).toFixed(2)}
                aria-invalid={!!fieldErrors.amount || undefined}
                onKeyDown={(e) => {
                  e.preventDefault();
                  if (e.key >= "0" && e.key <= "9") {
                    setCents((prev) => prev * 10 + Number(e.key));
                    if (fieldErrors.amount) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.amount;
                        return next;
                      });
                    }
                  } else if (e.key === "Backspace") {
                    setCents((prev) => Math.floor(prev / 10));
                  }
                }}
                onChange={() => {}}
                className="h-20 border-0 text-center text-5xl! font-semibold focus-visible:ring-0"
              />
              {fieldErrors.amount && (
                <p className="text-destructive text-xs">{fieldErrors.amount}</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-medium">Cashback</label>
              <ToggleGroup
                value={cashbackRate > 0 ? [String(cashbackRate)] : ["0"]}
                onValueChange={(values) =>
                  setCashbackRate(values.length > 0 ? Number(values[0]) : 0)
                }
                className="w-full"
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="0" className="flex-1">
                  None
                </ToggleGroupItem>
                {[1, 2, 3, 5].map((rate) => (
                  <ToggleGroupItem
                    key={rate}
                    value={String(rate)}
                    className="flex-1"
                  >
                    {rate}%
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              {cashbackRate > 0 && cents > 0 && (
                <p className="text-muted-foreground text-center text-sm">
                  After {cashbackRate}% cashback:{" "}
                  <span className="text-foreground font-semibold">
                    ${(effectiveCents / 100).toFixed(2)}
                  </span>
                  <span className="ml-1 text-xs text-green-600">
                    (−${(cashbackCents / 100).toFixed(2)})
                  </span>
                </p>
              )}
            </div>

            <UserSelect
              label="Split between"
              currentUser={currentUser}
              selected={participants}
              suggestedUsers={payers}
              onSelect={(users) => {
                setParticipants(users);
                setSplitAmounts((prev) => pruneAmounts(users, prev));
                if (fieldErrors.participants) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.participants;
                    return next;
                  });
                }
              }}
              totalCents={effectiveCents}
              evenSplit={splitEvenSplit}
              onEvenSplitChange={setSplitEvenSplit}
              customAmounts={splitAmounts}
              onCustomAmountsChange={setSplitAmounts}
              sharedCents={splitSharedCents}
              onSharedCentsChange={setSplitSharedCents}
              error={fieldErrors.participants}
              splitError={fieldErrors.participantsSplit}
            />

            <UserSelect
              label="Paid for by"
              currentUser={currentUser}
              selected={payers}
              suggestedUsers={participants}
              onSelect={(users) => {
                setPayers(users);
                setPayerAmounts((prev) => pruneAmounts(users, prev));
                if (fieldErrors.payers) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.payers;
                    return next;
                  });
                }
              }}
              totalCents={effectiveCents}
              evenSplit={payerEvenSplit}
              onEvenSplitChange={setPayerEvenSplit}
              customAmounts={payerAmounts}
              onCustomAmountsChange={setPayerAmounts}
              error={fieldErrors.payers}
              splitError={fieldErrors.payersSplit}
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
