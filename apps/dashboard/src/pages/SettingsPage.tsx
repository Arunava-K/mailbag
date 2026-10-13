import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "../components/app-shell";
import { useTheme } from "@/components/watermelon/astrix-dashboard/components/astrix/theme-provider";
import type { ToastFn } from "../lib/toast";
import { cn } from "@/lib/utils";

export function SettingsPage({
  collectorUrl, adminKey, apiOk, toast, onLock,
}: {
  collectorUrl: string;
  adminKey: string;
  apiOk: boolean;
  toast: ToastFn;
  onLock: () => void;
}) {
  const [reveal, setReveal] = useState(false);
  const { theme, setTheme } = useTheme();
  return (
    <>
      <PageHeader title="Settings" sub="Connection, appearance, and session." />
      <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Connection</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">API URL</dt>
              <dd className="font-mono text-xs">{collectorUrl}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="flex items-center gap-2 text-xs">
                <span className={cn("size-2 rounded-full", apiOk ? "bg-emerald-500" : "bg-destructive")} />
                {apiOk ? "reachable" : "unreachable"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Admin key</dt>
              <dd className="flex items-center gap-2 font-mono text-xs">
                {reveal ? adminKey : "••••••••••••"}
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setReveal((v) => !v)}>
                  {reveal ? "hide" : "show"}
                </button>
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => navigator.clipboard.writeText(adminKey).then(() => toast("Key copied"), () => toast("copy failed", "err"))}>
                  copy
                </button>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Appearance</CardTitle>
          <CardDescription>Applies instantly, remembered on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1 rounded-lg border bg-secondary p-0.5">
            {(
              [
                { v: "light", label: "Light", icon: Sun },
                { v: "dark", label: "Dark", icon: Moon },
              ] as const
            ).map((o) => {
              const Icon = o.icon;
              const active = theme === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setTheme(o.v)}
                  aria-pressed={active}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" /> {o.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Session</CardTitle>
          <CardDescription>
            The key lives in this browser only (localStorage). Locking clears it from this view.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={onLock}>Lock dashboard</Button>
        </CardContent>
      </Card>
      </div>
    </>
  );
}
