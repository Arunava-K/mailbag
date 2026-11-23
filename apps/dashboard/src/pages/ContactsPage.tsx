import { Download } from "lucide-react";
import { Btn } from "@/components/Btn";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { Page } from "@/components/shell/Page";
import { useExportCsv } from "@/lib/download";
import { useLists } from "@/lib/queries";
import { useSearchParams } from "@/lib/router";

/** /contacts: every list's contacts in one table. Export is per list, so it needs the list filter. */
export function ContactsPage() {
  const [params] = useSearchParams();
  const lists = useLists();
  const { exportCsv, exporting } = useExportCsv();
  const list = lists.data?.find((l) => l.list_key === params.get("list"));

  return (
    <Page
      bare
      crumbs={[{ label: "Contacts" }]}
      actions={
        <Btn
          aria-label="Export CSV"
          disabled={!list || exporting}
          onClick={() => list && void exportCsv(list.list_key, list.name)}
          title={list ? `Download ${list.name} as CSV` : "Filter to one list to export it"}
        >
          <Download />
          <span className="max-sm:hidden">{exporting ? "Exporting…" : "Export CSV"}</span>
        </Btn>
      }
    >
      <ContactsTable />
    </Page>
  );
}
