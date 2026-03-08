"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface User {
  id: number;
  name: string;
  email: string;
}

interface UserSearchProps {
  selected: User[];
  onSelect: (users: User[]) => void;
  label: string;
  excludeIds?: number[];
}

export function UserSearch({
  selected,
  onSelect,
  label,
  excludeIds = [],
}: UserSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const excludeIdsRef = useRef(excludeIds);
  excludeIdsRef.current = excludeIds;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
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

  useEffect(() => {
    search(query);
  }, [query, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(user: User) {
    onSelect([...selected, user]);
    setQuery("");
    setResults([]);
  }

  function handleRemove(userId: number) {
    onSelect(selected.filter((u) => u.id !== userId));
  }

  return (
    <div ref={containerRef} className="space-y-2">
      <label className="text-sm font-medium">{label}</label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((user) => (
            <Badge key={user.id} variant="secondary" className="gap-1 pr-1">
              {user.name}
              <button
                type="button"
                onClick={() => handleRemove(user.id)}
                className="hover:bg-foreground/10 ml-0.5 rounded-full p-0.5"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <Input
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />

        {open && (results.length > 0 || loading) && (
          <div className="bg-background absolute top-full left-0 z-50 mt-1 w-full rounded-lg border shadow-lg">
            {loading && results.length === 0 ? (
              <div className="text-muted-foreground px-3 py-2 text-sm">
                Searching…
              </div>
            ) : (
              results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="hover:bg-muted flex w-full flex-col px-3 py-2 text-left"
                  onClick={() => {
                    handleSelect(user);
                    setOpen(false);
                  }}
                >
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {user.email}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
