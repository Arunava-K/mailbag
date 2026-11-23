import { Lock, Monitor, Moon, Sun } from "lucide-react";
import { Btn } from "@/components/Btn";
import { Callout } from "@/components/DrawerParts";
import { Kbd } from "@/components/Kbd";
import { Panel, PanelHeader } from "@/components/Panel";
import { Segmented } from "@/components/Segmented";
import { StatusDot, type StatusTone } from "@/components/StatusLabel";
import { Page } from "@/components/shell/Page";
import { apiBase } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { type ApiStatus, useApiStatus, useBuildDrift } from "@/lib/queries";
import { SHORTCUT_GROUPS } from "@/lib/shortcuts";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { formatBuildTime, shortCommit, type BuildInfo } from "@/lib/version";

const statusUi: Record<ApiStatus, { tone: StatusTone; text: string }> = {
  checking: { tone: "warn", text: "Checking…" },
  online: { tone: "ok", text: "Online" },
  degraded: { tone: "warn", text: "Reachable, but admin requests are failing" },
  offline: { tone: "off", text: "Offline" },
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line-2 px-3.5 py-2.5 last:border-b-0">
      <dt className="w-28 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="m-0 min-w-0 flex-1 break-words text-[13px]">{children}</dd>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <Panel>
      <PanelHeader title={title} sub={sub} />
      {children}
    </Panel>
  );
}

function Connection() {
  const status = useApiStatus();
  const ui = statusUi[status];
  const base = apiBase();
  const absolute = new URL(base, window.location.origin).href.replace(/\/$/, "");
  return (
    <Section title="Connection">
      <dl className="m-0">
        <Row label="API URL">
          <code className="font-mono text-[12px]">{absolute}</code>
          {base !== absolute && <span className="ml-2 text-xs text-faint">({base}, proxied)</span>}
        </Row>
        <Row label="Status">
          <span className="inline-flex items-center gap-1.5">
            <StatusDot tone={ui.tone} />
            {ui.text}
          </span>
        </Row>
      </dl>
    </Section>
  );
}

const buildCell = (b: BuildInfo | null, f: (b: BuildInfo) => string) => (b ? f(b) : <span className="text-faint">not reported</span>);

function Builds() {
  const { apiBuild, dashboardBuild, drift } = useBuildDrift();
  const rows: [string, (b: BuildInfo) => string][] = [
    ["Version", (b) => (b.version === "dev" ? "dev" : `v${b.version}`)],
    ["Commit", (b) => shortCommit(b.commit)],
    ["Built", (b) => (b.build_time === "unknown" ? "unknown" : formatBuildTime(b.build_time))],
  ];
  return (
    <Section title="Builds" sub="what is running right now">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th scope="col" className="h-8 border-b border-line-2 px-3.5 text-left text-[11.5px] font-medium text-faint" />
              <th scope="col" className="h-8 border-b border-line-2 px-3.5 text-left text-[11.5px] font-medium text-faint">Dashboard</th>
              <th scope="col" className="h-8 border-b border-line-2 px-3.5 text-left text-[11.5px] font-medium text-faint">API</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, f]) => (
              <tr key={label}>
                <th scope="row" className="h-9 border-b border-line-2 px-3.5 text-left text-xs font-normal text-muted-foreground last:border-b-0">{label}</th>
                <td className="h-9 border-b border-line-2 px-3.5 font-mono text-[12px]">{buildCell(dashboardBuild, f)}</td>
                <td className="h-9 border-b border-line-2 px-3.5 font-mono text-[12px]">{buildCell(apiBuild, f)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3.5 pt-3 text-xs">
        {drift ? (
          <Callout tone="warn">
            <b>Out of sync.</b> The dashboard and the API are on different commits. That usually means only one container pulled the newest image after a
            deploy. Redeploy the stale one (or the whole stack) so both run the same build.
          </Callout>
        ) : (
          <p className="text-muted-foreground">
            {dashboardBuild.commit === "none" || apiBuild?.commit === "none"
              ? "At least one side is a local dev build with no commit recorded, so the two can't be compared."
              : apiBuild
                ? "Both are running the same commit."
                : "The API didn't report a build, so the two can't be compared."}
          </p>
        )}
      </div>
    </Section>
  );
}

function Appearance() {
  const { mode, setMode } = useTheme();
  return (
    <Section title="Appearance">
      <div className="flex flex-wrap items-center gap-3 p-3.5">
        <Segmented<ThemeMode>
          ariaLabel="Theme"
          value={mode}
          onChange={setMode}
          options={[
            { value: "light", label: <span className="inline-flex items-center gap-1.5"><Sun className="size-3.5" />Light</span> },
            { value: "dark", label: <span className="inline-flex items-center gap-1.5"><Moon className="size-3.5" />Dark</span> },
            { value: "system", label: <span className="inline-flex items-center gap-1.5"><Monitor className="size-3.5" />System</span> },
          ]}
        />
        <p className="text-xs text-faint">System follows your operating system and updates when it changes.</p>
      </div>
    </Section>
  );
}

function Shortcuts() {
  return (
    <Section title="Keyboard shortcuts" sub="plain keys are ignored while you type in a field">
      {SHORTCUT_GROUPS.map((g) => (
        <div key={g.title} className="border-b border-line-2 last:border-b-0">
          <h3 className="px-3.5 pt-3 pb-1 text-[11.5px] font-medium text-faint">{g.title}</h3>
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {g.items.map((s) => (
                <tr key={s.label}>
                  <th scope="row" className="h-8 w-[44%] px-3.5 text-left font-normal whitespace-nowrap">
                    <span className="inline-flex flex-wrap items-center gap-1">
                      {s.keys.map((k, i) => (
                        <Kbd key={i}>{k}</Kbd>
                      ))}
                    </span>
                  </th>
                  <td className="h-8 px-3.5 text-muted-foreground">{s.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Section>
  );
}

function Session() {
  const { lock } = useAuth();
  return (
    <Section title="Session">
      <div className="flex flex-wrap items-center gap-3 p-3.5">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          Your admin key is stored only in this browser (local storage). It is never sent anywhere except to your API. Locking forgets it here; you will need to
          enter it again.
        </p>
        <Btn onClick={lock}>
          <Lock />
          Lock
        </Btn>
      </div>
    </Section>
  );
}

/** /settings */
export function SettingsPage() {
  return (
    <Page crumbs={[{ label: "Settings" }]}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <Connection />
        <Builds />
        <Appearance />
        <Shortcuts />
        <Session />
      </div>
    </Page>
  );
}
