import { ActivityGroups, TypeChips, useActivityTypes } from "@/components/ActivityGroups";
import type { MailList } from "@/lib/api";

/** List → Activity: this list's events, grouped by day. */
export function ActivityTab({ list }: { list: MailList }) {
  const [types, setTypes] = useActivityTypes();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <TypeChips value={types} onChange={setTypes} />
      <ActivityGroups listKey={list.list_key} types={types} showList={false} />
    </div>
  );
}
