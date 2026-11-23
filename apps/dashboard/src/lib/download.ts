import { useCallback, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { useToast } from "./toast";

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "list";

/** Download a list's contacts as CSV. */
export function useExportCsv() {
  const { adminKey } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (listKey: string, listName: string) => {
      setBusy(true);
      try {
        saveBlob(await api.exportCsv(adminKey, listKey), `${slug(listName)}-contacts.csv`);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Export failed", "err");
      } finally {
        setBusy(false);
      }
    },
    [adminKey, toast],
  );
  return { exportCsv: run, exporting: busy };
}
