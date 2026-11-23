import { useState } from "react";
import { Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api, collectorUrl } from "@/lib/api";
import { Btn } from "./Btn";
import { Field } from "./Field";
import { Panel } from "./Panel";

/** Login screen: asks for ADMIN_API_KEY and verifies it against /admin/lists. */
export function KeyGate({ onUnlock }: { onUnlock: (key: string) => void }) {
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
      onUnlock(key);
    } catch {
      setError("That key didn't work. Check ADMIN_API_KEY and that the API is reachable.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Panel className="w-full max-w-sm p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-[7px] bg-brand text-primary-foreground">
            <Mail className="size-[15px]" strokeWidth={2} aria-hidden />
          </span>
          <h1 className="text-[15px] font-semibold tracking-tight">Mailbag</h1>
        </div>
        <p className="mt-3 text-[13px] text-muted-foreground">Enter your admin key to manage lists.</p>
        <p className="mt-1 truncate font-mono text-[11px] text-faint" title={collectorUrl()}>
          {collectorUrl()}
        </p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <Field id="admin-key" label="Admin key" error={error || undefined}>
            <Input
              id="admin-key"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="ADMIN_API_KEY"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "admin-key-error" : undefined}
              className="h-8 bg-panel"
            />
          </Field>
          <Btn type="submit" variant="primary" className="h-8 w-full" disabled={!value.trim() || checking}>
            {checking ? "Checking…" : "Unlock"}
          </Btn>
        </form>
        <p className="mt-4 text-[11.5px] text-faint">The key is stored in this browser only. Lock it any time from the sidebar.</p>
      </Panel>
    </div>
  );
}
