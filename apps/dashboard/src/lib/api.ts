export interface MailList {
  list_key: string;
  name: string;
  type: "newsletter" | "waitlist";
  sender_email: string;
  provider: "smtp" | "plunk";
  confirmed: number;
  pending: number;
}

export interface CreateListInput {
  name: string;
  type: "newsletter" | "waitlist";
  sender_name: string;
  sender_email: string;
  provider: "smtp" | "plunk";
  welcome_subject: string;
  welcome_body: string;
  confirm_redirect: string;
}

const base = () =>
  (import.meta.env.VITE_COLLECTOR_URL as string | undefined)?.replace(/\/$/, "") || "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function req<T>(path: string, key: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { error?: string }).error || `request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const api = {
  lists: (key: string) => req<MailList[]>("/admin/lists", key),
  createList: (key: string, input: CreateListInput) =>
    req<{ list_key: string; name: string }>("/admin/lists", key, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  exportCsv: async (key: string, listKey: string): Promise<Blob> => {
    const res = await fetch(`${base()}/admin/export?list_key=${encodeURIComponent(listKey)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new ApiError(res.status, `export failed (${res.status})`);
    return await res.blob();
  },
  health: async (): Promise<boolean> => {
    try {
      const res = await fetch(`${base()}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },
};

export function embedSnippet(collectorUrl: string, listKey: string): string {
  return `<form id="mc-form">
  <input type="email" name="email" required placeholder="you@example.com" />
  <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off" />
  <button type="submit">Subscribe</button>
  <p id="mc-msg"></p>
</form>
<script>
  (function () {
    var form = document.getElementById("mc-form");
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var res = await fetch("${collectorUrl}/v1/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          list_key: "${listKey}",
          email: fd.get("email"),
          website: fd.get("website"),
          metadata: JSON.stringify({ source: location.pathname })
        })
      });
      var data = await res.json();
      document.getElementById("mc-msg").textContent =
        data.status === "pending" ? "Check your inbox to confirm." :
        data.status === "confirmed" ? "You're already subscribed." :
        (data.error || "Something went wrong.");
    });
  })();
<\/script>`;
}
