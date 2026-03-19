"use client";

import { useState } from "react";
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

interface VoidExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseId: number;
  expenseDescription: string;
  expenseAmount: number;
  onVoided: () => void;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function VoidExpenseDialog({
  open,
  onOpenChange,
  expenseId,
  expenseDescription,
  expenseAmount,
  onVoided,
}: VoidExpenseDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleVoid() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/expenses/${expenseId}/void`, {
        method: "PATCH",
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to void expense");
        return;
      }

      if (data.autoSettlements > 0) {
        toast.info("Debt cycle detected and auto-settled");
      }

      toast.success("Expense voided");
      onVoided();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Void Expense</DialogTitle>
          <DialogDescription>
            Are you sure you want to void{" "}
            <span className="text-foreground font-medium">
              {expenseDescription}
            </span>{" "}
            ({formatCurrency(expenseAmount)})? This will reverse all debts from
            this expense.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleVoid}
            disabled={submitting}
          >
            {submitting ? "Voiding…" : "Void Expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
