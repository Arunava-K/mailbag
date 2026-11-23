import { useCallback, useEffect, useState } from "react";
import { Check, Inbox, SearchX, Send, ServerCrash, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { BulkAction, Contact, MailList } from "@/lib/api";
import { contactId } from "@/lib/contactRef";
import { useBulkContacts, useContacts, useLists } from "@/lib/queries";
import { paths } from "@/lib/routes";
import { useToast } from "@/lib/toast";
import { Btn, LinkBtn } from "../Btn";
import { ConfirmDialog } from "../ConfirmDialog";
import { EmptyState } from "../EmptyState";
import { BulkBar } from "../table/BulkBar";
import { useRowNav } from "../table/useRowNav";
import { useRowSelection } from "../table/useRowSelection";
import { summarizeBulk } from "./bulkSummary";
import { ContactDrawer } from "./ContactDrawer";
import { ContactsGrid } from "./ContactsGrid";
import { ContactsToolbar, countsFor } from "./ContactsToolbar";
import { PAGE_SIZE, useContactsView } from "./useContactsView";

const getId = (c: Contact) => contactId({ listKey: c.list_key, email: c.email });

/**
 * Contacts toolbar + table + bulk bar + drawer. Used by /contacts (all lists, with a list column and
 * filter) and by List detail → Contacts (`scope` pins one list). Fills its parent: render inside a
 * `<Page bare>` (or any flex column with a bounded height). State lives in the URL (useContactsView).
 */
export function ContactsTable({ scope }: { scope?: MailList }) {
  const scopeKey = scope?.list_key;
  const view = useContactsView(scopeKey);
  const toast = useToast();
  const lists = useLists();
  const contacts = useContacts(view.query);
  const bulk = useBulkContacts();
  const rows = contacts.data?.contacts ?? [];
  const total = contacts.data?.total ?? null;
  const [askDelete, setAskDelete] = useState(false);
  const [askResubscribe, setAskResubscribe] = useState(false);

  const sel = useRowSelection(rows, getId);
  const { setContact, setPage } = view;
  const openContact = useCallback((c: Contact) => setContact({ listKey: c.list_key, email: c.email.toLowerCase() }), [setContact]);
  const nav = useRowNav({
    count: rows.length,
    onOpen: (i) => openContact(rows[i]),
    onToggle: (i) => sel.toggle(getId(rows[i])),
  });

  // Deleting the last row of the last page leaves an empty page: step back.
  const pageCount = total === null ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (contacts.data && !contacts.isPlaceholderData && view.page > pageCount) setPage(pageCount);
  }, [contacts.data, contacts.isPlaceholderData, view.page, pageCount, setPage]);

  const runBulk = async (action: BulkAction) => {
    const picked = sel.selectedRows.map((c) => ({ list_key: c.list_key, email: c.email }));
    try {
      const res = await bulk.mutateAsync({ action, contacts: picked });
      const s = summarizeBulk(action, res);
      toast(s.msg, s.kind);
      if (action === "delete" && view.contact && picked.some((p) => p.list_key === view.contact?.listKey && p.email.toLowerCase() === view.contact.email)) {
        setContact(null, true);
      }
      sel.clear();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bulk action failed", "err");
      throw e;
    }
  };

  const unsubscribedCount = sel.selectedRows.filter((c) => c.status === "unsubscribed").length;
  const requestBulkConfirm = () => {
    if (unsubscribedCount > 0) setAskResubscribe(true);
    else void runBulk("confirm").catch(() => {});
  };

  // Esc: clear the selection first; only then close the drawer.
  const closeDrawer = useCallback(() => setContact(null, true), [setContact]);
  const escDrawer = useCallback(() => {
    if (sel.count === 0) closeDrawer();
  }, [sel.count, closeDrawer]);

  const counts = lists.data ? countsFor(lists.data, view.listKey) : null;
  const allLists = lists.data ?? [];
  const fromRows = view.contact ? rows.find((c) => c.list_key === view.contact?.listKey && c.email.toLowerCase() === view.contact.email) : undefined;
  const busy = bulk.isPending;

  let body;
  if (contacts.isPending) {
    body = (
      <div className="space-y-2 px-3 py-2 sm:px-5" aria-busy aria-label="Loading contacts">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    );
  } else if (contacts.isError && !contacts.data) {
    body = (
      <EmptyState
        tone="error"
        icon={ServerCrash}
        title="Couldn't load contacts"
        description={contacts.error instanceof Error ? contacts.error.message : undefined}
        action={<Btn onClick={() => void contacts.refetch()}>Retry</Btn>}
      />
    );
  } else if (rows.length === 0) {
    const noLists = !scope && lists.isSuccess && allLists.length === 0;
    body = view.hasFilters ? (
      <EmptyState
        icon={SearchX}
        title="No contacts match"
        description="Nothing fits the current filters. The status counts above ignore the email filter, so they can be higher than what you see."
        action={<Btn onClick={view.clearFilters}>Clear filters</Btn>}
      />
    ) : (
      <EmptyState
        icon={Inbox}
        title="No contacts yet"
        description={
          scope
            ? "Signups from this list's form will appear here. Paste the embed snippet on your site, or send a test signup."
            : noLists
              ? "Create a list first, then add its signup form to your site."
              : "Signups from any list's form will appear here."
        }
        action={
          scope ? (
            <LinkBtn to={paths.list(scope.list_key, "embed")}>Form &amp; embed</LinkBtn>
          ) : (
            <LinkBtn to={paths.lists()}>{noLists ? "Create a list" : "View lists"}</LinkBtn>
          )
        }
      />
    );
  } else {
    body = (
      <ContactsGrid
        rows={rows}
        lists={allLists}
        showList={!scope}
        sel={sel}
        activeRow={nav.active}
        open={view.contact}
        onOpen={openContact}
        dim={contacts.isPlaceholderData}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <ContactsToolbar
          status={view.status}
          onStatus={view.setStatus}
          q={view.q}
          onQ={view.setQ}
          stale={view.stale}
          onStale={view.setStale}
          counts={counts}
          lists={allLists}
          listKey={view.listKey}
          onList={view.setList}
          showListFilter={!scope}
          page={view.page}
          total={total}
          onPage={view.setPage}
          fetching={contacts.isFetching}
        />
        {body}
        <BulkBar
          count={sel.count}
          onClear={sel.clear}
          actions={[
            { label: "Confirm", icon: <Check />, onClick: requestBulkConfirm, disabled: busy },
            { label: "Resend", icon: <Send />, onClick: () => void runBulk("resend").catch(() => {}), disabled: busy },
            { label: "Delete", icon: <Trash2 />, onClick: () => setAskDelete(true), danger: true, disabled: busy },
          ]}
        />
      </div>
      <ContactDrawer target={view.contact} fromRows={fromRows} onClose={closeDrawer} onEscape={escDrawer} />
      <ConfirmDialog
        open={askResubscribe}
        onOpenChange={setAskResubscribe}
        title={`Confirm ${sel.count} ${sel.count === 1 ? "contact" : "contacts"}?`}
        description={`${unsubscribedCount === 1 ? "One selected contact has" : `${unsubscribedCount} selected contacts have`} unsubscribed. Confirming manually subscribes them again, and they will receive mail. Only continue if they asked you to.`}
        confirmLabel={`Confirm ${sel.count}`}
        onConfirm={() => runBulk("confirm")}
      />
      <ConfirmDialog
        open={askDelete}
        onOpenChange={setAskDelete}
        title={`Delete ${sel.count} ${sel.count === 1 ? "contact" : "contacts"}?`}
        description="They are removed from their lists for good. Anyone who signs up again starts as a new, unconfirmed contact."
        confirmLabel={`Delete ${sel.count}`}
        destructive
        onConfirm={() => runBulk("delete")}
      />
    </div>
  );
}
