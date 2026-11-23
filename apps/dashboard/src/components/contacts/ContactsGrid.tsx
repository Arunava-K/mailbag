import type { Contact, MailList } from "@/lib/api";
import { looksLikePath, sourceOf } from "@/lib/contactMeta";
import { contactId, type ContactRef } from "@/lib/contactRef";
import { fullTime, relTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusLabel } from "../StatusLabel";
import { TypeDot } from "../TypeDot";
import { RowCheckbox } from "../table/RowCheckbox";
import { Table, TableScroll, Td, Th, Tr } from "../table/Table";
import type { useRowSelection } from "../table/useRowSelection";

const first = "pl-3 pr-0 sm:pl-5";
const last = "pr-3 sm:pr-5";
const stickyTh = "sticky top-0 z-10 border-t border-line-2 bg-background";

/** The contacts table proper. Rows open the drawer on click (and on Enter via useRowNav). */
export function ContactsGrid({
  rows,
  lists,
  showList,
  sel,
  activeRow,
  open,
  onOpen,
  dim,
}: {
  rows: Contact[];
  lists: MailList[];
  showList: boolean;
  sel: ReturnType<typeof useRowSelection<Contact>>;
  activeRow: number | null;
  open: ContactRef | null;
  onOpen: (c: Contact) => void;
  dim: boolean;
}) {
  const typeOf = (key: string) => lists.find((l) => l.list_key === key)?.type;
  return (
    <TableScroll className={cn("min-h-0 flex-1 overflow-y-auto", dim && "opacity-60 transition-opacity")}>
      <Table className="border-separate border-spacing-0">
        <thead>
          <tr>
            <Th className={cn(stickyTh, first, "w-[18px]")}>
              <RowCheckbox
                checked={sel.allSelected}
                indeterminate={sel.someSelected}
                onToggle={() => sel.toggleAll()}
                label="Select all contacts on this page"
              />
            </Th>
            <Th className={stickyTh}>Email</Th>
            <Th className={stickyTh}>Status</Th>
            {showList && <Th className={stickyTh}>List</Th>}
            <Th className={stickyTh}>Source</Th>
            <Th right className={stickyTh}>Signed up</Th>
            <Th right className={cn(stickyTh, last)}>Confirmed</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => {
            const id = contactId({ listKey: c.list_key, email: c.email });
            const isOpen = open?.listKey === c.list_key && open.email === c.email.toLowerCase();
            const src = sourceOf(c.metadata);
            const type = typeOf(c.list_key);
            return (
              <Tr
                key={id}
                data-row-index={i}
                selected={sel.isSelected(id)}
                open={isOpen}
                active={activeRow === i}
                onClick={() => onOpen(c)}
                className="cursor-pointer"
              >
                <Td className={cn(first, "h-[34px]")} onClick={(e) => e.stopPropagation()}>
                  <RowCheckbox checked={sel.isSelected(id)} onToggle={(shift) => sel.toggle(id, shift)} label={`Select ${c.email}`} />
                </Td>
                <Td className="h-[34px]">
                  <button
                    type="button"
                    aria-label={`Open ${c.email}`}
                    className={cn("block max-w-[16rem] truncate rounded-sm text-left sm:max-w-[22rem]", isOpen && "font-semibold")}
                  >
                    {c.email}
                  </button>
                </Td>
                <Td className="h-[34px]">
                  <StatusLabel status={c.status} />
                </Td>
                {showList && (
                  <Td className="h-[34px]">
                    <span className="inline-flex max-w-[11rem] items-center gap-2">
                      {type && <TypeDot type={type} />}
                      <span className="truncate">{c.list_name}</span>
                    </span>
                  </Td>
                )}
                <Td className={cn("h-[34px] text-muted-foreground")}>
                  {src ? (
                    <span className={cn("block max-w-[12rem] truncate", looksLikePath(src) && "font-mono text-[11.5px]")} title={src}>
                      {src}
                    </span>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td right className="h-[34px] text-faint tabular" title={fullTime(c.created_at)}>
                  {relTime(c.created_at)}
                </Td>
                <Td right className={cn("h-[34px] text-faint tabular", last)} title={fullTime(c.confirmed_at)}>
                  {relTime(c.confirmed_at)}
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </TableScroll>
  );
}
