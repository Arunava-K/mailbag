import { useState } from "react";
import { Btn, Field, inputCls } from "../components/ui";
import { emptyListInput, type CreateListInput } from "../lib/api";

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
      <Field label="Name"><input required className={inputCls} value={form.name} onChange={set("name")} placeholder="AI Directory" /></Field>
      <Field label="Sender email"><input required type="email" className={inputCls} value={form.sender_email} onChange={set("sender_email")} /></Field>
      <Field label="Type">
        <select className={inputCls} value={form.type} onChange={set("type")}>
          <option value="newsletter">newsletter</option>
          <option value="waitlist">waitlist</option>
        </select>
      </Field>
      <Field label="Provider">
        <select className={inputCls} value={form.provider} onChange={set("provider")}>
          <option value="smtp">smtp</option>
          <option value="plunk">plunk</option>
        </select>
      </Field>
      <Field label="Sender name"><input className={inputCls} value={form.sender_name} onChange={set("sender_name")} /></Field>
      <Field label="Confirm redirect"><input className={inputCls} value={form.confirm_redirect} onChange={set("confirm_redirect")} placeholder="https://…/thanks" /></Field>
      <Field label="Welcome subject"><input className={inputCls} value={form.welcome_subject} onChange={set("welcome_subject")} /></Field>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">Welcome body (html)</label>
        <textarea rows={3} className={inputCls} value={form.welcome_body} onChange={set("welcome_body")} />
      </div>
      <div className="md:col-span-2">
        <Btn type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : submitLabel}</Btn>
      </div>
    </form>
  );
}
