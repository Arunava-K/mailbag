import type { ActivityEvent, ActivityType } from "@/lib/api";
import { agoShort, fmtClock, fullTime } from "@/lib/format";
import { Link } from "@/lib/router";
import { paths } from "@/lib/routes";
import { StatusDot, type StatusTone } from "./StatusLabel";

const tone: Record<ActivityType, StatusTone> = { signup: "warn", confirmed: "ok", unsubscribed: "off" };
const verb: Record<ActivityType, string> = { signup: "signed up", confirmed: "confirmed", unsubscribed: "unsubscribed" };

/**
 * Compact event list (33px rows): status dot, email (links to that contact), "verb · list", age.
 * Used on Overview (limit 8) and, grouped by day, on the Activity pages (see ActivityGroups).
 */
export function ActivityFeed({
  events,
  now = Date.now(),
  showList = true,
  clock,
}: {
  events: ActivityEvent[];
  now?: number;
  /** append "· list name" (turn off inside a single list) */
  showList?: boolean;
  /** show the time of day ("14:32") instead of the age; use under day headings */
  clock?: boolean;
}) {
  return (
    <ul className="m-0 list-none p-0 py-1">
      {events.map((e) => (
        <li key={`${e.type}-${e.list_key}-${e.email}-${e.at}`} className="flex h-[33px] items-center gap-[9px] px-3.5">
          <StatusDot tone={tone[e.type]} />
          <Link
            to={paths.contact(e.list_key, e.email)}
            className="min-w-0 flex-1 truncate rounded-sm hover:underline"
          >
            {e.email}{" "}
            <span className="text-muted-foreground">
              {verb[e.type]}
              {showList && ` · ${e.list_name}`}
            </span>
          </Link>
          <time dateTime={e.at} title={fullTime(e.at)} className="shrink-0 text-[11.5px] text-faint tabular">
            {clock ? fmtClock(e.at) : agoShort(e.at, now)}
          </time>
        </li>
      ))}
    </ul>
  );
}
