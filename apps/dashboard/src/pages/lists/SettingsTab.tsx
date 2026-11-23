import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Btn } from "@/components/Btn";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, selectClass } from "@/components/Field";
import { Panel, PanelHeader } from "@/components/Panel";
import { Segmented } from "@/components/Segmented";
import { validateList } from "@/components/shell/NewListDialog";
import { listToInput, type CreateListInput, type ListType, type MailList, type Provider } from "@/lib/api";
import { fmtNum } from "@/lib/format";
import { useDeleteList, useUpdateList } from "@/lib/queries";
import { navigate } from "@/lib/router";
import { paths } from "@/lib/routes";
import { useToast } from "@/lib/toast";
import { useUnsavedGuard } from "@/lib/useUnsavedGuard";

type Draft = Pick<CreateListInput, "name" | "type" | "sender_name" | "sender_email" | "provider" | "confirm_redirect">;
const fieldsOf = (l: MailList): Draft => ({
  name: l.name,
  type: l.type,
  sender_name: l.sender_name,
  sender_email: l.sender_email,
  provider: l.provider,
  confirm_redirect: l.confirm_redirect,
});

function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Panel>
      <PanelHeader title={title} sub={description} />
      <div className="flex flex-col gap-3.5 p-3.5">{children}</div>
    </Panel>
  );
}

function DeleteList({ list }: { list: MailList }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const del = useDeleteList();
  const toast = useToast();
  const total = list.confirmed + list.pending + list.unsubscribed;
  return (
    <Panel className="border-danger/40">
      <PanelHeader title="Danger zone" />
      <div className="flex flex-wrap items-center gap-3 p-3.5">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          Deleting <b className="font-medium text-foreground">{list.name}</b> permanently removes the list and its{" "}
          <b className="font-medium text-foreground tabular">{fmtNum(total)}</b> {total === 1 ? "contact" : "contacts"}. Its embed form stops working. This can't be
          undone.
        </p>
        <Btn
          variant="danger"
          className="border-danger/40"
          onClick={() => {
            setTyped("");
            setOpen(true);
          }}
        >
          Delete list
        </Btn>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete “${list.name}”?`}
        description={`This removes the list and all ${fmtNum(total)} of its contacts for good. Export them first if you need a copy.`}
        confirmLabel="Delete list"
        destructive
        confirmDisabled={typed !== list.name}
        onConfirm={async () => {
          try {
            await del.mutateAsync(list.list_key);
          } catch (e) {
            toast(e instanceof Error ? e.message : "Couldn't delete the list", "err");
            throw e;
          }
          toast(`Deleted “${list.name}”`);
          navigate(paths.lists(), { force: true });
        }}
      >
        <Field id="del-confirm" label={`Type “${list.name}” to confirm`}>
          <Input
            id="del-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="h-8 bg-panel"
          />
        </Field>
      </ConfirmDialog>
    </Panel>
  );
}

/** List → Settings. Saves the full list object (PATCH overwrites every field). */
export function SettingsTab({ list }: { list: MailList }) {
  const [draft, setDraft] = useState<Draft>(() => fieldsOf(list));
  const [submitted, setSubmitted] = useState(false);
  const update = useUpdateList();
  const toast = useToast();
  const saved = fieldsOf(list);
  const dirty = (Object.keys(saved) as (keyof Draft)[]).some((k) => saved[k] !== draft[k]);
  const guard = useUnsavedGuard(dirty);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const merged: CreateListInput = { ...listToInput(list), ...draft };
  const errors = validateList(merged);
  const err = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const first = Object.keys(errors)[0];
    if (first) {
      document.getElementById(`ls-${first}`)?.focus();
      return;
    }
    update.mutate(
      {
        listKey: list.list_key,
        input: {
          ...merged,
          name: merged.name.trim(),
          sender_name: merged.sender_name.trim(),
          sender_email: merged.sender_email.trim(),
          confirm_redirect: merged.confirm_redirect.trim(),
        },
      },
      {
        onSuccess: () => {
          setSubmitted(false);
          toast("Settings saved");
        },
        onError: (er) => toast(er instanceof Error ? er.message : "Couldn't save", "err"),
      },
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        <Group title="Basics">
          <Field id="ls-name" label="Name" error={err("name")}>
            <Input
              id="ls-name"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              autoComplete="off"
              aria-invalid={err("name") ? true : undefined}
              aria-describedby={err("name") ? "ls-name-error" : undefined}
              className="h-8 bg-panel"
            />
          </Field>
          <div className="space-y-1.5">
            <span className="text-xs font-medium">Type</span>
            <div>
              <Segmented<ListType>
                ariaLabel="List type"
                value={draft.type}
                onChange={(v) => set("type", v)}
                options={[
                  { value: "newsletter", label: "Newsletter" },
                  { value: "waitlist", label: "Waitlist" },
                ]}
              />
            </div>
          </div>
        </Group>

        <Group title="Sender" description="Who confirmation and welcome mail comes from">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="ls-sender_name" label="Sender name" optional>
              <Input id="ls-sender_name" value={draft.sender_name} onChange={(e) => set("sender_name", e.target.value)} autoComplete="off" className="h-8 bg-panel" />
            </Field>
            <Field id="ls-sender_email" label="Sender email" error={err("sender_email")}>
              <Input
                id="ls-sender_email"
                type="email"
                value={draft.sender_email}
                onChange={(e) => set("sender_email", e.target.value)}
                autoComplete="off"
                aria-invalid={err("sender_email") ? true : undefined}
                aria-describedby={err("sender_email") ? "ls-sender_email-error" : undefined}
                className="h-8 bg-panel"
              />
            </Field>
          </div>
          <Field id="ls-provider" label="Provider" hint="How mail for this list is delivered.">
            <select
              id="ls-provider"
              className={selectClass}
              value={draft.provider}
              onChange={(e) => set("provider", e.target.value as Provider)}
            >
              <option value="smtp">SMTP</option>
              <option value="plunk">Plunk</option>
            </select>
          </Field>
        </Group>

        <Group title="After confirming">
          <Field
            id="ls-confirm_redirect"
            label="Confirm redirect URL"
            optional
            hint="Where people land after clicking the confirmation link. Empty shows a plain “You're confirmed” page."
            error={err("confirm_redirect")}
          >
            <Input
              id="ls-confirm_redirect"
              type="url"
              inputMode="url"
              value={draft.confirm_redirect}
              onChange={(e) => set("confirm_redirect", e.target.value)}
              placeholder="https://example.com/thanks"
              autoComplete="off"
              aria-invalid={err("confirm_redirect") ? true : undefined}
              aria-describedby={err("confirm_redirect") ? "ls-confirm_redirect-error" : "ls-confirm_redirect-hint"}
              className="h-8 bg-panel"
            />
          </Field>
        </Group>

        <div className="flex items-center justify-end gap-2">
          {dirty && <span className="mr-auto text-xs text-warning">Unsaved changes</span>}
          <Btn
            onClick={() => {
              setDraft(fieldsOf(list));
              setSubmitted(false);
            }}
            disabled={!dirty || update.isPending}
          >
            Revert
          </Btn>
          <Btn type="submit" variant="primary" disabled={!dirty || update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Btn>
        </div>
      </form>
      <DeleteList list={list} />
      {guard}
    </div>
  );
}
