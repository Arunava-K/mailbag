import { ActivityGroups, TypeChips, useActivityTypes } from "@/components/ActivityGroups";
import { Page } from "@/components/shell/Page";
import { useLists } from "@/lib/queries";
import { useSearchParams } from "@/lib/router";

/** /activity: everything that happened across lists, newest first. The first page refreshes every 30s. */
export function ActivityPage() {
  const [params, setParams] = useSearchParams();
  const lists = useLists();
  const listKey = params.get("list") || undefined;
  const [types, setTypes] = useActivityTypes();

  return (
    <Page crumbs={[{ label: "Activity" }]}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <TypeChips value={types} onChange={setTypes} />
          <span className="flex-1" />
          <select
            aria-label="List"
            value={listKey ?? ""}
            onChange={(e) => setParams({ list: e.target.value || null }, { replace: false })}
            className="h-7 max-w-52 rounded-[7px] border border-line bg-panel px-2 text-xs font-medium outline-none focus-visible:border-brand"
          >
            <option value="">All lists</option>
            {(lists.data ?? []).map((l) => (
              <option key={l.list_key} value={l.list_key}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <ActivityGroups key={listKey ?? "all"} listKey={listKey} types={types} showList={!listKey} />
      </div>
    </Page>
  );
}
