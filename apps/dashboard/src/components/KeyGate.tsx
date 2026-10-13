import { useState } from "react";
import { Mailbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "../lib/api";

export function KeyGate({
  collectorUrl,
  onUnlock,
}: {
  collectorUrl: string;
  onUnlock: (key: string) => void;
}) {
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = value.trim();
    if (!key || checking) return;
    setChecking(true);
    setError("");
    try {
      await api.lists(key);
      localStorage.setItem("mb-admin-key", key);
      onUnlock(key);
    } catch {
      setError("That key didn't work — check ADMIN_API_KEY and try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="astrix-dashboard flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Mailbox className="size-4.5" />
          </span>
          <CardTitle className="mt-3">Mailbag</CardTitle>
          <CardDescription>
            Enter your admin key to manage lists.
            <span className="mt-1 block font-mono text-[11px]">{collectorUrl}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="admin-key">Admin key</Label>
              <Input
                id="admin-key"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="ADMIN_API_KEY"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "key-error" : undefined}
              />
              {error && (
                <p id="key-error" role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={!value.trim() || checking}>
              {checking ? "Checking…" : "Unlock"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
