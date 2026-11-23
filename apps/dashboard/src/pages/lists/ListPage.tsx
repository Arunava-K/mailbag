import { Download, FileQuestion, Send, ServerCrash } from "lucide-react";
import { Btn, LinkBtn } from "@/components/Btn";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { EmptyState } from "@/components/EmptyState";
import { Page } from "@/components/shell/Page";
import { Skeleton } from "@/components/ui/skeleton";
import { useExportCsv } from "@/lib/download";
import { useLists } from "@/lib/queries";
import type { ListTab } from "@/lib/routes";
import { paths } from "@/lib/routes";
import { useState } from "react";
import { ActivityTab } from "./ActivityTab";
import { EmailTab } from "./EmailTab";
import { EmbedTab } from "./EmbedTab";
import { KeyChip, ListHeader } from "./ListHeader";
import { SettingsTab } from "./SettingsTab";
import { TestSignupDialog } from "./TestSignupDialog";

/** /lists/:key[/:tab]. Contacts is the table + drawer; the other tabs scroll inside the page body. */
export function ListPage({ listKey, tab }: { listKey: string; tab: ListTab }) {
  const lists = useLists();
  const { exportCsv, exporting } = useExportCsv();
  const [testOpen, setTestOpen] = useState(false);
  const list = lists.data?.find((l) => l.list_key === listKey);
  const listsCrumb = { label: "Lists", to: paths.lists() };

  if (lists.isError && !lists.data) {
    return (
      <Page crumbs={[listsCrumb, { label: "List" }]}>
        <EmptyState
          tone="error"
          icon={ServerCrash}
          title="Couldn't load this list"
          description={lists.error instanceof Error ? lists.error.message : undefined}
          action={<Btn onClick={() => void lists.refetch()}>Retry</Btn>}
        />
      </Page>
    );
  }
  if (lists.isPending) {
    return (
      <Page crumbs={[listsCrumb, { label: "…" }]}>
        <div className="space-y-3" aria-busy aria-label="Loading list">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Page>
    );
  }
  if (!list) {
    return (
      <Page crumbs={[listsCrumb, { label: "Not found" }]}>
        <EmptyState
          icon={FileQuestion}
          title="List not found"
          description={`There is no list with the key “${listKey}”. It may have been deleted, or the link is wrong.`}
          action={<LinkBtn to={paths.lists()} variant="primary">Back to Lists</LinkBtn>}
        />
      </Page>
    );
  }

  return (
    <Page
      bare
      crumbs={[listsCrumb, { label: list.name }]}
      actions={
        <>
          <KeyChip listKey={list.list_key} />
          <Btn onClick={() => setTestOpen(true)} aria-label="Test signup">
            <Send />
            <span className="max-sm:hidden">Test signup</span>
          </Btn>
          <Btn onClick={() => void exportCsv(list.list_key, list.name)} disabled={exporting} aria-label="Export CSV">
            <Download />
            <span className="max-sm:hidden">{exporting ? "Exporting…" : "Export CSV"}</span>
          </Btn>
        </>
      }
    >
      <ListHeader list={list} tab={tab} />
      {tab === "contacts" ? (
        <ContactsTable key={list.list_key} scope={list} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {tab === "activity" && <ActivityTab key={list.list_key} list={list} />}
          {tab === "embed" && <EmbedTab list={list} />}
          {tab === "email" && <EmailTab key={list.list_key} list={list} />}
          {tab === "settings" && <SettingsTab key={list.list_key} list={list} />}
        </div>
      )}
      <TestSignupDialog list={list} open={testOpen} onOpenChange={setTestOpen} />
    </Page>
  );
}
