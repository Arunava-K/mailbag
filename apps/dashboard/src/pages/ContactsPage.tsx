import { useEffect, useState } from "react";
import { ContactsTable } from "../components/ContactsTable";
import { Empty, inputCls, type Toast } from "../components/ui";
import type { MailList } from "../lib/api";

export function ContactsPage({
  lists, adminKey, toast,
}: {
  lists: MailList[];
  adminKey: string;
  toast: (msg: string, kind?: Toast["kind"]) => void;
}) {
  const [listKey, setListKey] = useState(lists[0]?.list_key ?? "");
  useEffect(() => {
    if (!lists.find((l) => l.list_key === listKey)) setListKey(lists[0]?.list_key ?? "");
  }, [lists, listKey]);

  if (lists.length === 0) return <Empty>Create a list first.</Empty>;
  return (
    <div className="space-y-3">
      <select value={listKey} onChange={(e) => setListKey(e.target.value)} className={`${inputCls} md:w-72`}>
        {lists.map((l) => (
          <option key={l.list_key} value={l.list_key}>{l.name}</option>
        ))}
      </select>
      {listKey && <ContactsTable listKey={listKey} adminKey={adminKey} toast={toast} />}
    </div>
  );
}
