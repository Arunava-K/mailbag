import { useRef, useState } from "react";
import { Check, Clock, Send, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Contact } from "@/lib/api";
import { fmtDuration, fullTime, hoursSince, parseTs } from "@/lib/format";
import { parseMetadata, prettyMetadata, looksLikePath } from "@/lib/contactMeta";
import type { ContactRef } from "@/lib/contactRef";
import { useConfirmContact, useContacts, useDeleteContact, useResendContact } from "@/lib/queries";
import { useToast } from "@/lib/toast";
import { Btn } from "../Btn";
import { ConfirmDialog } from "../ConfirmDialog";
import { Drawer } from "../Drawer";
import { Callout, DrawerSection, KeyValueList, Timeline, TimelineEvent } from "../DrawerParts";
import { StatusLabel } from "../StatusLabel";
import { STALE_HOURS } from "./useContactsView";

function Metadata({ raw }: { raw: string }) {
  const [showRaw, setShowRaw] = useState(false);
  const meta = parseMetadata(raw);
  const empty = meta.kind === "object" && meta.entries.length === 0;
  return (
    <>
      <DrawerSection>Metadata</DrawerSection>
      {empty ? (
        <p className="text-xs text-faint">No metadata was sent with this signup.</p>
      ) : (
        <>
          {meta.kind === "text" && <p className="text-xs text-muted-foreground">This metadata isn't JSON, so it's shown as received.</p>}
          {meta.kind === "object" && !showRaw && <KeyValueList items={meta.entries} />}
          {(meta.kind === "text" || showRaw) && (
            <pre className="max-h-48 overflow-auto rounded-md bg-hover p-2.5 font-mono text-[11.5px] leading-relaxed break-words whitespace-pre-wrap">
              {meta.kind === "text" ? meta.text : prettyMetadata(raw)}
            </pre>
          )}
          {meta.kind === "object" && (
            <button
              type="button"
              aria-pressed={showRaw}
              onClick={() => setShowRaw((v) => !v)}
              className="self-start rounded text-xs font-medium text-brand hover:underline"
            >
              {showRaw ? "View as list" : "View raw JSON"}
            </button>
          )}
        </>
      )}
    </>
  );
}

function ContactTimeline({ c }: { c: Contact }) {
  const meta = parseMetadata(c.metadata);
  const source = meta.kind === "object" ? meta.source : null;
  const signedUp = parseTs(c.created_at);
  const confirmed = parseTs(c.confirmed_at);
  const waited = signedUp ? Date.now() - signedUp.getTime() : null;
  return (
    <>
      <DrawerSection>Timeline</DrawerSection>
      <Timeline>
        <TimelineEvent
          title={
            <>
              Signed up
              {source && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  from <span className={looksLikePath(source) ? "font-mono text-[11.5px]" : ""}>{source}</span>
                </span>
              )}
            </>
          }
          detail={fullTime(c.created_at)}
        />
        {c.status === "pending" ? (
          <TimelineEvent hollow title="Waiting for confirmation" detail={waited !== null ? `${fmtDuration(waited)} so far` : undefined} />
        ) : (
          confirmed && (
            <TimelineEvent
              title="Confirmed"
              detail={
                <>
                  {fullTime(c.confirmed_at)}
                  {signedUp && ` · ${fmtDuration(confirmed.getTime() - signedUp.getTime())} after signup`}
                </>
              }
            />
          )
        )}
        {c.unsubscribed_at && <TimelineEvent title="Unsubscribed" detail={fullTime(c.unsubscribed_at)} />}
      </Timeline>
      {c.status === "unsubscribed" && !c.unsubscribed_at && (
        <p className="text-xs text-faint">Unsubscribed before the time was recorded, so there is no date to show.</p>
      )}
    </>
  );
}

function Actions({ c, onGone }: { c: Contact; onGone: () => void }) {
  const toast = useToast();
  const resend = useResendContact();
  const confirm = useConfirmContact();
  const del = useDeleteContact();
  const [askDelete, setAskDelete] = useState(false);
  const [askResub, setAskResub] = useState(false);
  const ref = { listKey: c.list_key, email: c.email };
  const busy = resend.isPending || confirm.isPending || del.isPending;
  const fail = (e: unknown) => toast(e instanceof Error ? e.message : "Something went wrong", "err");

  const doResend = () => resend.mutate(ref, { onSuccess: () => toast(`Confirmation email sent to ${c.email}`), onError: fail });
  const doConfirm = () =>
    confirm.mutate(ref, {
      onSuccess: () => toast(c.status === "unsubscribed" ? `${c.email} is subscribed again` : `${c.email} confirmed`),
      onError: fail,
    });

  const deleteBtn = (
    <Btn variant="danger" onClick={() => setAskDelete(true)} disabled={busy} className={c.status === "confirmed" ? "w-full" : undefined}>
      <Trash2 />
      Delete
    </Btn>
  );

  return (
    <>
      {c.status === "pending" && (
        <>
          <Btn variant="primary" className="w-full" onClick={doResend} disabled={busy}>
            <Send />
            {resend.isPending ? "Sending…" : "Resend confirmation"}
          </Btn>
          <div className="flex gap-2">
            <Btn className="flex-1" onClick={doConfirm} disabled={busy}>
              <Check />
              Confirm manually
            </Btn>
            {deleteBtn}
          </div>
        </>
      )}
      {c.status === "confirmed" && deleteBtn}
      {c.status === "unsubscribed" && (
        <>
          <p className="text-xs text-muted-foreground">
            Confirming manually subscribes them again, and they will receive mail from this list. Only do it if they asked you to.
          </p>
          <div className="flex gap-2">
            <Btn className="flex-1" onClick={() => setAskResub(true)} disabled={busy}>
              <Check />
              Confirm manually
            </Btn>
            {deleteBtn}
          </div>
        </>
      )}
      <ConfirmDialog
        open={askResub}
        onOpenChange={setAskResub}
        title="Subscribe this contact again?"
        description={`${c.email} unsubscribed from ${c.list_name}. Confirming manually puts them back on the list as confirmed.`}
        confirmLabel="Confirm manually"
        onConfirm={() => doConfirm()}
      />
      <ConfirmDialog
        open={askDelete}
        onOpenChange={setAskDelete}
        title={`Delete ${c.email}?`}
        description={`This removes them from ${c.list_name} for good. If they sign up again they start as a new, unconfirmed contact.`}
        confirmLabel="Delete contact"
        destructive
        onConfirm={async () => {
          try {
            await del.mutateAsync(ref);
            toast(`${c.email} deleted`);
            onGone();
          } catch (e) {
            fail(e);
            throw e;
          }
        }}
      />
    </>
  );
}

/**
 * Right-side contact panel. `fromRows` is the contact if the table already has it; otherwise
 * (deep link, other page, active filter) it is fetched by email.
 */
export function ContactDrawer({
  target,
  fromRows,
  onClose,
  onEscape,
}: {
  target: ContactRef | null;
  fromRows?: Contact;
  onClose: () => void;
  onEscape?: () => void;
}) {
  const lookup = useContacts(
    { listKey: target?.listKey, q: target?.email, limit: 10 },
    { enabled: !!target && !fromRows },
  );
  const found = fromRows ?? lookup.data?.contacts.find((c) => c.email.toLowerCase() === target?.email && c.list_key === target?.listKey);
  // Keep showing the last version while a refetch swaps sources (e.g. a confirmed contact leaving a "pending" filter).
  const last = useRef<Contact | undefined>(undefined);
  if (found) last.current = found;
  const contact = found ?? (last.current && last.current.list_key === target?.listKey && last.current.email.toLowerCase() === target?.email ? last.current : undefined);

  if (!target) return null;
  const loading = !contact && (lookup.isPending || lookup.isFetching);

  if (!contact) {
    return (
      <Drawer open onClose={onClose} onEscape={onEscape} label="Contact details" title={target.email} meta={loading ? undefined : <span className="text-muted-foreground">Not found</span>}>
        {loading ? (
          <>
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            {lookup.isError
              ? "Couldn't load this contact."
              : "This contact doesn't exist in that list. It may have been deleted or the link is wrong."}
          </p>
        )}
      </Drawer>
    );
  }

  const hours = contact.status === "pending" ? hoursSince(contact.created_at) : null;
  return (
    <Drawer
      open
      onClose={onClose}
      onEscape={onEscape}
      label={`Contact ${contact.email}`}
      title={contact.email}
      meta={
        <>
          <StatusLabel status={contact.status} />
          <span className="text-faint">· {contact.list_name}</span>
        </>
      }
      footer={<Actions c={contact} onGone={onClose} />}
    >
      {hours !== null && hours >= STALE_HOURS && (
        <Callout icon={<Clock />}>
          Unconfirmed for <b>{hours} hours</b>. The link may have gone to spam. Resend it, or confirm by hand if they asked you directly.
        </Callout>
      )}
      <ContactTimeline c={contact} />
      <Metadata raw={contact.metadata} />
    </Drawer>
  );
}
