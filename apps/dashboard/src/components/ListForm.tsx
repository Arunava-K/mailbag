import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { emptyListInput, type CreateListInput } from "../lib/api";
import { cn } from "@/lib/utils";

const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function ListForm({
  initial = emptyListInput,
  saving,
  submitLabel = "Save",
  onSubmit,
}: {
  initial?: CreateListInput;
  saving: boolean;
  submitLabel?: string;
  onSubmit: (v: CreateListInput) => void;
}) {
  const [form, setForm] = useState(initial);
  const set =
    (k: keyof CreateListInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      className="grid grid-cols-1 gap-3 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...form, type: form.type as "newsletter" | "waitlist", provider: form.provider as "smtp" | "plunk" });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="lf-name">Name</Label>
        <Input id="lf-name" required value={form.name} onChange={set("name")} placeholder="Weekly Newsletter" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lf-email">Sender email</Label>
        <Input id="lf-email" required type="email" value={form.sender_email} onChange={set("sender_email")} placeholder="hello@example.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lf-type">Type</Label>
        <select id="lf-type" className={cn(selectCls, "dark:bg-input/30")} value={form.type} onChange={set("type")}>
          <option value="newsletter">Newsletter</option>
          <option value="waitlist">Waitlist</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lf-provider">Provider</Label>
        <select id="lf-provider" className={cn(selectCls, "dark:bg-input/30")} value={form.provider} onChange={set("provider")}>
          <option value="smtp">SMTP</option>
          <option value="plunk">Plunk</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lf-sender">Sender name</Label>
        <Input id="lf-sender" value={form.sender_name} onChange={set("sender_name")} placeholder="Your Name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lf-redirect">Confirm redirect</Label>
        <Input id="lf-redirect" value={form.confirm_redirect} onChange={set("confirm_redirect")} placeholder="https://…/thanks" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lf-subject">Welcome subject</Label>
        <Input id="lf-subject" value={form.welcome_subject} onChange={set("welcome_subject")} placeholder="Welcome!" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lf-body">Welcome body (HTML)</Label>
        <Textarea id="lf-body" rows={3} value={form.welcome_body} onChange={set("welcome_body")} placeholder="<p>Thanks for joining.</p>" />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
