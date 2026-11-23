import { SearchX } from "lucide-react";
import { Page } from "@/components/shell/Page";
import { EmptyState } from "@/components/EmptyState";
import { LinkBtn } from "@/components/Btn";
import { paths } from "@/lib/routes";

export function NotFound() {
  return (
    <Page crumbs={[{ label: "Not found" }]}>
      <EmptyState
        icon={SearchX}
        title="Page not found"
        description="That address doesn't match anything in Mailbag."
        action={<LinkBtn to={paths.overview()} variant="primary">Go to Overview</LinkBtn>}
      />
    </Page>
  );
}
