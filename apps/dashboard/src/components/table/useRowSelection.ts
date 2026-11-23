import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Checkbox selection over the visible rows, with shift-click range select.
 *   const sel = useRowSelection(rows, (r) => `${r.list_key}:${r.email}`);
 *   <RowCheckbox checked={sel.isSelected(id)} onToggle={(shift) => sel.toggle(id, shift)} … />
 *   header: checked={sel.allSelected} indeterminate={sel.someSelected} onToggle={sel.toggleAll}
 * Ids that disappear from `rows` (filter change, refetch) drop out of the selection.
 */
export function useRowSelection<T>(rows: T[], getId: (row: T) => string) {
  const [raw, setRaw] = useState<Set<string>>(new Set());
  const anchor = useRef<string | null>(null);

  const ids = useMemo(() => rows.map(getId), [rows, getId]);
  const selected = useMemo(() => {
    const present = new Set(ids);
    return new Set([...raw].filter((id) => present.has(id)));
  }, [raw, ids]);

  const toggle = useCallback(
    (id: string, shift = false) => {
      // Read the anchor now: React may run the updater after `anchor.current` has been reassigned below.
      const anchorId = anchor.current;
      setRaw((prev) => {
        const next = new Set([...prev].filter((x) => ids.includes(x)));
        const from = anchorId ? ids.indexOf(anchorId) : -1;
        const to = ids.indexOf(id);
        if (shift && from >= 0 && to >= 0) {
          const [a, b] = from < to ? [from, to] : [to, from];
          const turnOn = !next.has(id);
          for (let i = a; i <= b; i++) {
            if (turnOn) next.add(ids[i]);
            else next.delete(ids[i]);
          }
        } else if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      anchor.current = id;
    },
    [ids],
  );

  const toggleAll = useCallback(() => {
    setRaw((prev) => (ids.length > 0 && ids.every((id) => prev.has(id)) ? new Set() : new Set(ids)));
    anchor.current = null;
  }, [ids]);

  const clear = useCallback(() => {
    setRaw(new Set());
    anchor.current = null;
  }, []);

  return {
    selected,
    count: selected.size,
    selectedRows: useMemo(() => rows.filter((r) => selected.has(getId(r))), [rows, selected, getId]),
    isSelected: (id: string) => selected.has(id),
    allSelected: ids.length > 0 && selected.size === ids.length,
    someSelected: selected.size > 0 && selected.size < ids.length,
    toggle,
    toggleAll,
    clear,
  };
}
