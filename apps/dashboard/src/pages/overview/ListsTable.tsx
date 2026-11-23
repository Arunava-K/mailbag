import { ChevronRight } from "lucide-react";
import { Panel, PanelHeader } from "@/components/Panel";
import { Sparkline } from "@/components/Sparkline";
import { Tag } from "@/components/Tag";
import { TypeDot, typeLabel } from "@/components/TypeDot";
import { LinkBtn } from "@/components/Btn";
import { Table, TableScroll, Td, Th, Tr } from "@/components/table/Table";
import { Skeleton } from "@/components/ui/skeleton";
import type { MailList } from "@/lib/api";
import { fmtNum } from "@/lib/format";
import { Link } from "@/lib/router";
import { paths } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** Overview lists table. `series` is stats.list_series (aligned with the selected range). */
export function ListsTable({
  lists,
  series,
  range,
  loading,
}: {
  lists: MailList[];
  series?: Record<string, number[]>;
  range: number;
  loading: boolean;
}) {
  return (
    <Panel className="min-w-0 overflow-hidden">
      <PanelHeader
        title="Lists"
        actions={
          <LinkBtn to={paths.lists()} variant="ghost" size="sm">
            View all
            <ChevronRight />
          </LinkBtn>
        }
      />
      {loading ? (
        <div className="space-y-2 p-3.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : (
        <TableScroll>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th right>Confirmed</Th>
                <Th right>Pending</Th>
                <Th right>Unsubscribed</Th>
                <Th className="w-[112px]">{range}d signups</Th>
              </tr>
            </thead>
            <tbody>
              {lists.map((l) => {
                const s = series?.[l.list_key];
                return (
                  <Tr key={l.list_key}>
                    <Td>
                      <Link to={paths.list(l.list_key)} className="inline-flex items-center gap-2 rounded-sm font-medium hover:underline">
                        <TypeDot type={l.type} />
                        {l.name}
                      </Link>
                    </Td>
                    <Td>
                      <Tag>{typeLabel[l.type]}</Tag>
                    </Td>
                    <Td num>{fmtNum(l.confirmed)}</Td>
                    <Td num className={cn(l.stale_pending > 0 ? "font-medium text-warning" : l.pending === 0 && "text-muted-foreground")}>
                      {fmtNum(l.pending)}
                    </Td>
                    <Td num className="text-muted-foreground">
                      {fmtNum(l.unsubscribed)}
                    </Td>
                    <Td>
                      {s ? (
                        <Sparkline
                          width={88}
                          values={s}
                          label={`${l.name}: ${fmtNum(s.reduce((a, b) => a + b, 0))} confirmed signups in the last ${range} days`}
                        />
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableScroll>
      )}
    </Panel>
  );
}
