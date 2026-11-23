import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KeyGate } from "@/components/KeyGate";
import { AppShell } from "@/components/shell/AppShell";
import { AuthProvider } from "@/lib/auth";
import { createQueryClient } from "@/lib/queries";
import { matchRoute } from "@/lib/routes";
import { usePath } from "@/lib/router";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider } from "@/lib/toast";
import { ActivityPage } from "@/pages/ActivityPage";
import { ContactsPage } from "@/pages/ContactsPage";
import { ListPage } from "@/pages/lists/ListPage";
import { ListsPage } from "@/pages/lists/ListsPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { NotFound } from "@/pages/NotFound";
import { OverviewPage } from "@/pages/overview/OverviewPage";

const queryClient = createQueryClient();

function Routes() {
  const route = matchRoute(usePath());
  switch (route.name) {
    case "overview":
      return <OverviewPage />;
    case "contacts":
      return <ContactsPage />;
    case "activity":
      return <ActivityPage />;
    case "lists":
      return <ListsPage />;
    case "list":
      return <ListPage listKey={route.key} tab={route.tab} />;
    case "settings":
      return <SettingsPage />;
    case "notfound":
      return <NotFound />;
  }
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider delayDuration={300}>
          <ToastProvider>
            <AuthProvider gate={(unlock) => <KeyGate onUnlock={unlock} />}>
              <AppShell>
                <Routes />
              </AppShell>
            </AuthProvider>
          </ToastProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
