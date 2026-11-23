import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { emptyListInput, type CreateListInput, type ListType, type Provider } from "@/lib/api";
import { useCreateList } from "@/lib/queries";
import { navigate } from "@/lib/router";
import { paths } from "@/lib/routes";
import { useToast } from "@/lib/toast";
import { Btn } from "../Btn";
import { Field, selectClass } from "../Field";
import { Kbd } from "../Kbd";
import { Segmented } from "../Segmented";

type Errors = Partial<Record<"name" | "sender_email" | "confirm_redirect", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateList(v: CreateListInput): Errors {
  const e: Errors = {};
  if (!v.name.trim()) e.name = "Give the list a name.";
  else if (v.name.trim().length > 80) e.name = "Keep the name under 80 characters.";
  if (!v.sender_email.trim()) e.sender_email = "Sender email is required.";
  else if (!EMAIL.test(v.sender_email.trim())) e.sender_email = "Enter a valid email address.";
  const r = v.confirm_redirect.trim();
  if (r) {
    try {
      const u = new URL(r);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
    } catch {
      e.confirm_redirect = "Use a full URL starting with http:// or https://.";
    }
  }
  return e;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="mb-2 p-0 text-[11.5px] font-medium text-faint">{title}</legend>
      {children}
    </fieldset>
  );
}

function NewListForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState<CreateListInput>(emptyListInput);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState("");
  const create = useCreateList();
  const toast = useToast();

  const errors = validateList(form);
  const show = (k: keyof Errors) => (submitted || touched[k] ? errors[k] : undefined);
  const set = <K extends keyof CreateListInput>(k: K, v: CreateListInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  const invalid = (k: keyof Errors) => (show(k) ? true : undefined);
  const describe = (k: keyof Errors) => (show(k) ? `${k}-error` : undefined);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setApiError("");
    if (Object.keys(errors).length > 0) {
      document.getElementById(`nl-${Object.keys(errors)[0]}`)?.focus();
      return;
    }
    try {
      const res = await create.mutateAsync({
        ...form,
        name: form.name.trim(),
        sender_name: form.sender_name.trim(),
        sender_email: form.sender_email.trim(),
        confirm_redirect: form.confirm_redirect.trim(),
      });
      toast(`Created “${res.name}”`);
      onDone();
      navigate(paths.list(res.list_key));
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Could not create the list.");
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <div className="flex flex-col gap-5 overflow-y-auto px-5 pb-1">
        <Group title="Basics">
          <Field id="nl-name" label="Name" error={show("name")}>
            <Input
              id="nl-name"
              autoFocus
              autoComplete="off"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              onBlur={blur("name")}
              placeholder="Weekly newsletter"
              aria-invalid={invalid("name")}
              aria-describedby={describe("name")}
              className="h-8 bg-panel"
            />
          </Field>
          <div className="space-y-1.5">
            <span id="nl-type-label" className="text-xs font-medium">
              Type
            </span>
            <div>
              <Segmented<ListType>
                ariaLabel="List type"
                value={form.type}
                onChange={(v) => set("type", v)}
                options={[
                  { value: "newsletter", label: "Newsletter" },
                  { value: "waitlist", label: "Waitlist" },
                ]}
              />
            </div>
          </div>
        </Group>

        <Group title="Sender">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="nl-sender_name" label="Sender name" optional>
              <Input
                id="nl-sender_name"
                autoComplete="off"
                value={form.sender_name}
                onChange={(e) => set("sender_name", e.target.value)}
                placeholder="Your name"
                className="h-8 bg-panel"
              />
            </Field>
            <Field id="nl-sender_email" label="Sender email" error={show("sender_email")}>
              <Input
                id="nl-sender_email"
                type="email"
                autoComplete="off"
                value={form.sender_email}
                onChange={(e) => set("sender_email", e.target.value)}
                onBlur={blur("sender_email")}
                placeholder="hello@example.com"
                aria-invalid={invalid("sender_email")}
                aria-describedby={describe("sender_email")}
                className="h-8 bg-panel"
              />
            </Field>
          </div>
          <Field id="nl-provider" label="Provider" hint="How confirmation and welcome mail is sent.">
            <select
              id="nl-provider"
              className={selectClass}
              value={form.provider}
              onChange={(e) => set("provider", e.target.value as Provider)}
            >
              <option value="smtp">SMTP</option>
              <option value="plunk">Plunk</option>
            </select>
          </Field>
        </Group>

        <Group title="Optional">
          <Field
            id="nl-confirm_redirect"
            label="Confirm redirect"
            optional
            hint="Where people land after confirming. Leave empty for the default page."
            error={show("confirm_redirect")}
          >
            <Input
              id="nl-confirm_redirect"
              type="url"
              inputMode="url"
              autoComplete="off"
              value={form.confirm_redirect}
              onChange={(e) => set("confirm_redirect", e.target.value)}
              onBlur={blur("confirm_redirect")}
              placeholder="https://example.com/thanks"
              aria-invalid={invalid("confirm_redirect")}
              aria-describedby={describe("confirm_redirect") ?? "nl-confirm_redirect-hint"}
              className="h-8 bg-panel"
            />
          </Field>
        </Group>

        {apiError && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
            {apiError}
          </p>
        )}
      </div>
      <div className="mt-4 flex items-center justify-end gap-2 border-t border-line-2 px-5 py-3">
        <Btn onClick={onDone} disabled={create.isPending}>
          Cancel
        </Btn>
        <Btn type="submit" variant="primary" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create list"}
          {!create.isPending && <Kbd onAccent>↵</Kbd>}
        </Btn>
      </div>
    </form>
  );
}

/** Global "New list" dialog (sidebar +, ⌘K, the C shortcut). Welcome email is edited later, on the list's Email tab. */
export function NewListDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="max-h-[calc(100svh-2rem)] gap-0 bg-panel p-0 pt-5 sm:max-w-md">
        <div className="mb-4 space-y-1 px-5">
          <DialogTitle className="text-sm font-semibold">New list</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            A list collects signups with double opt-in. You can write its welcome email afterwards.
          </DialogDescription>
        </div>
        <NewListForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
