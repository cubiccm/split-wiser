"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Scale } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";

interface User {
  id: number;
  name: string;
  email: string;
}

interface UserSelectProps {
  selected: User[];
  onSelect: (users: User[]) => void;
  label: string;
  currentUser?: User;
  excludeIds?: number[];
  suggestedUsers?: User[];
  totalCents?: number;
  evenSplit?: boolean;
  onEvenSplitChange?: (even: boolean) => void;
  customAmounts?: Record<number, number>;
  onCustomAmountsChange?: (amounts: Record<number, number>) => void;
  sharedCents?: number;
  onSharedCentsChange?: (cents: number) => void;
  error?: string;
  splitError?: string;
}

function distributeProportionally(
  userIds: number[],
  customAmounts: Record<number, number>,
  totalCents: number,
  sharedCents: number = 0,
): Record<number, number> {
  const individualTarget = totalCents - sharedCents;
  const currentSum = userIds.reduce(
    (sum, id) => sum + (customAmounts[id] ?? 0),
    0,
  );
  if (currentSum === 0 || individualTarget <= 0) return customAmounts;

  const entries = userIds.map((id) => {
    const exact = ((customAmounts[id] ?? 0) / currentSum) * individualTarget;
    return {
      id,
      floor: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });

  let remaining =
    individualTarget - entries.reduce((sum, e) => sum + e.floor, 0);
  entries.sort((a, b) => b.remainder - a.remainder);
  for (const entry of entries) {
    if (remaining <= 0) break;
    entry.floor += 1;
    remaining -= 1;
  }

  const result: Record<number, number> = {};
  for (const entry of entries) {
    result[entry.id] = entry.floor;
  }
  return result;
}

function AmountInput({
  amountCents,
  onAmountChange,
}: {
  amountCents: number;
  onAmountChange: (cents: number) => void;
}) {
  const [localValue, setLocalValue] = useState<string | null>(null);
  const displayValue =
    localValue !== null ? localValue : (amountCents / 100).toFixed(2);

  return (
    <div className="relative w-28 shrink-0">
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm">
        $
      </span>
      <Input
        type="text"
        inputMode="decimal"
        className="pl-6 text-right"
        value={displayValue}
        onFocus={(e) => {
          setLocalValue((amountCents / 100).toFixed(2));
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => {
          const parsed = parseFloat(localValue ?? "0");
          const cents = Math.round(
            (isNaN(parsed) ? 0 : Math.abs(parsed)) * 100,
          );
          onAmountChange(cents);
          setLocalValue(null);
        }}
      />
    </div>
  );
}

export function UserSelect({
  selected,
  onSelect,
  label,
  currentUser,
  excludeIds = [],
  suggestedUsers = [],
  totalCents,
  evenSplit,
  onEvenSplitChange,
  customAmounts,
  onCustomAmountsChange,
  sharedCents,
  onSharedCentsChange,
  error,
  splitError,
}: UserSelectProps) {
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasQuery, setHasQuery] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const anchor = useComboboxAnchor();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const excludeIdsRef = useRef(excludeIds);
  excludeIdsRef.current = excludeIds;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/users/recent")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => {
        if (!cancelled) setRecentUsers(data.users);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestionItems = useMemo(() => {
    const excludeSet = new Set([...excludeIds, ...selected.map((u) => u.id)]);
    const seen = new Set<number>();
    const items: User[] = [];

    const add = (user: User) => {
      if (!excludeSet.has(user.id) && !seen.has(user.id)) {
        seen.add(user.id);
        items.push(user);
      }
    };

    if (currentUser) add(currentUser);
    suggestedUsers.forEach(add);
    recentUsers.forEach(add);

    return items;
  }, [currentUser, suggestedUsers, recentUsers, excludeIds, selected]);

  const hasSuggestions = suggestionItems.length > 0;
  const displayItems = hasQuery ? results : suggestionItems;
  const isOpen = hasQuery || (showSuggestions && hasSuggestions);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length === 0) {
      setResults([]);
      setHasQuery(false);
      setShowSuggestions(true);
      return;
    }
    setShowSuggestions(false);
    setHasQuery(true);
    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(q.trim())}`,
        );
        if (res.ok) {
          const data = await res.json();
          const excludeSet = new Set([
            ...excludeIdsRef.current,
            ...selectedRef.current.map((u) => u.id),
          ]);
          setResults(data.users.filter((u: User) => !excludeSet.has(u.id)));
        }
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const hasSplitProps =
    totalCents !== undefined && onEvenSplitChange && onCustomAmountsChange;
  const showSplitUI = hasSplitProps && selected.length > 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">{label}</label>
        <Combobox
          multiple
          items={displayItems}
          filter={null}
          itemToStringValue={(user: User) => `${user.name} ${user.email}`}
          isItemEqualToValue={(a: User, b: User) => a.id === b.id}
          value={selected}
          onValueChange={onSelect}
          onInputValueChange={(value) => search(value)}
          open={isOpen}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setHasQuery(false);
              setShowSuggestions(false);
            }
          }}
        >
          <ComboboxChips ref={anchor}>
            <ComboboxValue>
              {(values: User[]) => (
                <>
                  {values.map((user) => (
                    <ComboboxChip key={user.id}>
                      <>
                        <span className="text-xs leading-tight font-medium">
                          {user.name}
                        </span>
                        <span className="text-muted-foreground text-xs leading-tight">
                          ({user.email})
                        </span>
                      </>
                    </ComboboxChip>
                  ))}
                  <ComboboxChipsInput
                    placeholder="Search by name or email…"
                    aria-invalid={!!error || undefined}
                    onFocus={() => {
                      if (!hasQuery) setShowSuggestions(true);
                    }}
                    onBlur={() => {
                      setShowSuggestions(false);
                      setHasQuery(false);
                    }}
                  />
                </>
              )}
            </ComboboxValue>
          </ComboboxChips>
          <ComboboxContent anchor={anchor}>
            <ComboboxEmpty>
              {loading ? "Searching…" : "No users found."}
            </ComboboxEmpty>
            {showSuggestions && !hasQuery ? (
              <ComboboxList>
                <ComboboxGroup>
                  <ComboboxLabel>Suggested</ComboboxLabel>
                  {suggestionItems.map((user) => (
                    <ComboboxItem key={user.id} value={user}>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{user.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {user.email}
                        </span>
                      </div>
                    </ComboboxItem>
                  ))}
                </ComboboxGroup>
              </ComboboxList>
            ) : (
              <ComboboxList>
                {(user: User) => (
                  <ComboboxItem key={user.id} value={user}>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{user.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {user.email}
                      </span>
                    </div>
                  </ComboboxItem>
                )}
              </ComboboxList>
            )}
          </ComboboxContent>
        </Combobox>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>

      {showSplitUI && (
        <>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={evenSplit}
              onCheckedChange={(checked) => onEvenSplitChange(checked === true)}
            />
            <span className="text-sm font-medium">Split evenly</span>
          </label>

          {!evenSplit && customAmounts && (
            <div className="bg-accent space-y-4 rounded-lg px-4 py-3">
              {onSharedCentsChange && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Shared</p>
                      <p className="text-muted-foreground text-xs">
                        Split evenly between all
                      </p>
                    </div>
                    <AmountInput
                      amountCents={sharedCents ?? 0}
                      onAmountChange={(cents) => onSharedCentsChange(cents)}
                    />
                  </div>
                  <div className="border-border border-t" />
                </>
              )}
              <div className="flex flex-col gap-2">
                {selected.map((user) => {
                  const amountCents = customAmounts[user.id] ?? 0;
                  return (
                    <div key={user.id} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {user.name}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {user.email}
                        </p>
                      </div>
                      <AmountInput
                        amountCents={amountCents}
                        onAmountChange={(cents) =>
                          onCustomAmountsChange({
                            ...customAmounts,
                            [user.id]: cents,
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
              {(() => {
                const individualCents = selected.reduce(
                  (sum, u) => sum + (customAmounts[u.id] ?? 0),
                  0,
                );
                const assignedCents = individualCents + (sharedCents ?? 0);
                const mismatch = Math.abs(assignedCents - totalCents) > 1;
                return (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-muted-foreground text-xs">
                        Total assigned:{" "}
                        <span
                          className={
                            mismatch
                              ? "text-destructive font-medium"
                              : "font-medium text-green-600"
                          }
                        >
                          ${(assignedCents / 100).toFixed(2)}
                        </span>{" "}
                        / ${(totalCents / 100).toFixed(2)}
                      </p>
                      {mismatch && individualCents > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() =>
                            onCustomAmountsChange(
                              distributeProportionally(
                                selected.map((u) => u.id),
                                customAmounts,
                                totalCents,
                                sharedCents ?? 0,
                              ),
                            )
                          }
                        >
                          <Scale />
                          Adjust proportionally
                        </Button>
                      )}
                    </div>
                    {splitError && (
                      <p className="text-destructive text-xs font-medium">
                        {splitError}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
