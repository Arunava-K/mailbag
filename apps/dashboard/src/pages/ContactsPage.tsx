import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ContactsTable } from "../components/ContactsTable";
import type { MailList } from "../lib/api";
import type { ToastFn } from "../lib/toast";

export function ContactsPage({
  lists, adminKey, toast,
}: {
  lists: MailList[];
  adminKey: string;
  toast: ToastFn;
}) {
  const [listKey, setListKey] = useState(lists[0]?.list_key ?? "");
  useEffect(() => {
    if (!lists.find((l) => l.list_key === listKey)) setListKey(lists[0]?.list_key ?? "");
  }, [lists, listKey]);

  if (lists.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Create a list first — contacts live on lists.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      <select
        value={listKey}
        onChange={(e) => setListKey(e.target.value)}
        aria-label="Choose list"
        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:w-72 dark:bg-input/30"
      >
        {lists.map((l) => (
          <option key={l.list_key} value={l.list_key}>{l.name}</option>
        ))}
      </select>
      {listKey && <ContactsTable listKey={listKey} adminKey={adminKey} toast={toast} />}
    </div>
  );
}
