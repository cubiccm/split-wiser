"use client";

import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginFormProps {
  onSuccess: (user: { id: number; name: string; email: string }) => void;
}

// Set by `pnpm dev:local`; lets the email form skip the passkey check.
const devBypass = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "1";

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function devLogin(email: string) {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login/dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Login failed");
      }

      const { user } = await res.json();
      onSuccess(user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setLoading(false);
    }
  }

  async function authenticate(email?: string) {
    setError("");
    setLoading(true);

    try {
      const optionsRes = await fetch("/api/auth/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!optionsRes.ok) {
        const data = await optionsRes.json();
        throw new Error(data.error ?? "Failed to start login");
      }

      const options = await optionsRes.json();
      const assertion = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error ?? "Login failed");
      }

      const { user } = await verifyRes.json();
      onSuccess(user);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("Passkey authentication was cancelled");
        } else {
          setError(err.message);
        }
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (devBypass) {
      await devLogin(email);
    } else {
      await authenticate(email);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={loading}
        onClick={() => authenticate()}
      >
        <KeyRound className="mr-2 h-4 w-4" />
        {loading ? "Verifying passkey…" : "Sign in with passkey"}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card text-muted-foreground px-2">
            or use email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          {devBypass && (
            <p className="text-muted-foreground text-xs">
              Dev mode: passkey check bypassed
            </p>
          )}
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {devBypass
            ? loading
              ? "Signing in…"
              : "Sign in (dev bypass)"
            : loading
              ? "Verifying passkey…"
              : "Sign in with email"}
        </Button>
      </form>
    </div>
  );
}
