import { useState, type ReactNode } from "react";
import { CheckCircle2, Clock, GitCompare, Mail } from "lucide-react";
import { Panel, PanelHeader } from "@/components/Panel";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Btn, LinkBtn } from "@/components/Btn";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type BulkContact, type MailList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtNum } from "@/lib/format";
import { paths } from "@/lib/routes";
import { useBuildDrift, useBulkContacts } from "@/lib/queries";
import { shortCommit } from "@/lib/version";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const STALE_HOURS = 48;
const CHUNK = 500;

function Item({ icon, warn, title, children, actions }: { icon: ReactNode; warn?: boolean; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <li className="flex gap-2.5 border-b border-line-2 px-3.5 py-2.5 last:border-b-0">
      <span
        aria-hidden
        className={cn("grid size-6 shrink-0 place-items-center rounded-md [&_svg]:size-[13px]", warn ? "bg-warning-soft text-warning" : "bg-hover text-muted-foreground")}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <b className="font-medium">{title}</b>
        {children && <p className="mt-px text-xs text-muted-foreground">{children}</p>}
        {actions && <div className="mt-2 flex gap-1.5">{actions}</div>}
      </div>
    </li>
  );
}

/** Fetch every pending contact older than 48h, then resend in chunks of 500. */
async function resendAllStale(adminKey: string, bulk: ReturnType<typeof useBulkContacts>) {
  const targets: BulkContact[] = [];
  for (let offset = 0; offset < 10_000; offset += CHUNK) {
    const page = await api.contacts(adminKey, { pendingOlderThan: STALE_HOURS, limit: CHUNK, offset });
    targets.push(...page.contacts.map((c) => ({ list_key: c.list_key, email: c.email })));
    if (page.contacts.length < CHUNK || targets.length >= page.total) break;
  }
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < targets.length; i += CHUNK) {
    const r = await bulk.mutateAsync({ action: "resend", contacts: targets.slice(i, i + CHUNK) });
    ok += r.ok;
    failed += r.failed.length;
  }
  return { total: targets.length, ok, failed };
}

/**
 * Overview "Needs attention": built only from real data.
 * stale pending (Resend all / Review), lists whose welcome subject or body is empty, build drift.
 */
export function NeedsAttention({ lists, loading }: { lists: MailList[]; loading: boolean }) {
  const { adminKey } = useAuth();
  const toast = useToast();
  const bulk = useBulkContacts();
  const { apiBuild, dashboardBuild, drift } = useBuildDrift();
  const [confirm, setConfirm] = useState(false);

  const stale = lists.reduce((s, l) => s + l.stale_pending, 0);
  const staleLists = lists.filter((l) => l.stale_pending > 0).sort((a, b) => b.stale_pending - a.stale_pending);
  const noWelcome = lists.filter((l) => !l.welcome_subject.trim() || !l.welcome_body.trim());
  const shownNoWelcome = noWelcome.length > 3 ? noWelcome.slice(0, 2) : noWelcome;

  const count = (stale > 0 ? 1 : 0) + noWelcome.length + (drift ? 1 : 0);

  const doResend = async () => {
    try {
      const r = await resendAllStale(adminKey, bulk);
      if (r.total === 0) toast("Nothing to resend: no pending contacts older than 48h.");
      else if (r.failed > 0) toast(`Resent ${fmtNum(r.ok)} of ${fmtNum(r.total)}; ${fmtNum(r.failed)} failed.`, "err");
      else toast(`Resent confirmation to ${fmtNum(r.ok)} contact${r.ok === 1 ? "" : "s"}.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Resend failed", "err");
      throw e;
    }
  };

  return (
    <Panel aria-label="Needs attention">
      <PanelHeader title="Needs attention" sub={loading ? undefined : count > 0 ? count : undefined} />
      {loading ? (
        <div className="space-y-3 p-3.5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-4/5" />
        </div>
      ) : count === 0 ? (
        <EmptyState compact icon={CheckCircle2} title="All clear" description="No stuck signups, missing welcome emails or build mismatches." />
      ) : (
        <ul className="m-0 list-none p-0 py-1">
          {stale > 0 && (
            <Item
              warn
              icon={<Clock />}
              title={`${fmtNum(stale)} signup${stale === 1 ? "" : "s"} stuck pending`}
              actions={
                <>
                  <Btn size="sm" onClick={() => setConfirm(true)}>
                    Resend all
                  </Btn>
                  <LinkBtn size="sm" variant="ghost" to={paths.contacts({ stale: true })}>
                    Review
                  </LinkBtn>
                </>
              }
            >
              Older than 48h
              {staleLists.length > 0 && <> · {staleLists.slice(0, 3).map((l) => `${fmtNum(l.stale_pending)} on ${l.name}`).join(", ")}</>}
            </Item>
          )}
          {shownNoWelcome.map((l) => (
            <Item
              key={l.list_key}
              icon={<Mail />}
              title={`${l.name} uses the default welcome email`}
              actions={
                <LinkBtn size="sm" to={paths.list(l.list_key, "email")}>
                  Write one
                </LinkBtn>
              }
            >
              The subject or body is empty, so subscribers get a generic message after confirming.
            </Item>
          ))}
          {noWelcome.length > 3 && (
            <Item
              icon={<Mail />}
              title={`${noWelcome.length - 2} more lists use the default welcome email`}
              actions={
                <LinkBtn size="sm" to={paths.lists()}>
                  View lists
                </LinkBtn>
              }
            />
          )}
          {drift && (
            <Item icon={<GitCompare />} title="Builds out of sync">
              API <span className="font-mono">{shortCommit(apiBuild?.commit ?? "")}</span> · dashboard{" "}
              <span className="font-mono">{shortCommit(dashboardBuild.commit)}</span>. Only one container got the newest image; redeploy so both match.
            </Item>
          )}
        </ul>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Resend confirmation emails?"
        description={`Sends a fresh confirmation email to every contact who has been pending for more than ${STALE_HOURS} hours (about ${fmtNum(stale)} right now). Confirmed and unsubscribed contacts are skipped.`}
        confirmLabel="Resend all"
        onConfirm={doResend}
      />
    </Panel>
  );
}
