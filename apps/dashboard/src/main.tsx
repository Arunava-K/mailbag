import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/watermelon/astrix-dashboard/components/astrix/theme-provider";
import App from "./App";
import "./index.css";
import "./components/watermelon/astrix-dashboard/dashboard.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider storageKey="mailbag-theme" defaultTheme="light">
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
);
