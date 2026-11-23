import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Btn } from "@/components/Btn";
import { Callout } from "@/components/DrawerParts";
import { Field } from "@/components/Field";
import { Kbd, modKey } from "@/components/Kbd";
import { Panel, PanelHeader } from "@/components/Panel";
import { listToInput, type MailList } from "@/lib/api";
import { hasMod } from "@/lib/keys";
import { useUpdateList } from "@/lib/queries";
import { useToast } from "@/lib/toast";
import { useUnsavedGuard } from "@/lib/useUnsavedGuard";

/** A white "mail client" page, whatever the dashboard theme. Scripts, forms and navigation are blocked by sandbox="". */
function emailDoc(body: string): string {
  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:20px;background:#fff;color:#1b1b1a;font:14px/1.6 system-ui,sans-serif}img{max-width:100%}a{color:#3b3bb5}
</style>${body}`;
}

/** List → Welcome email: subject + HTML body with a live, sandboxed preview. */
export function EmailTab({ list }: { list: MailList }) {
  const [subject, setSubject] = useState(list.welcome_subject);
  const [body, setBody] = useState(list.welcome_body);
  const update = useUpdateList();
  const toast = useToast();
  const dirty = subject !== list.welcome_subject || body !== list.welcome_body;
  const guard = useUnsavedGuard(dirty);
  const usingDefault = !subject.trim() || !body.trim();
  const saving = update.isPending;

  const save = () => {
    if (!dirty || saving) return;
    // PATCH overwrites every field: start from the current list, change only the email fields.
    update.mutate(
      { listKey: list.list_key, input: { ...listToInput(list), welcome_subject: subject, welcome_body: body } },
      {
        onSuccess: () => toast("Welcome email saved"),
        onError: (e) => toast(e instanceof Error ? e.message : "Couldn't save", "err"),
      },
    );
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (hasMod(e) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Callout tone="info" icon={<Info />}>
        {usingDefault ? (
          <>
            <b>This list uses the default welcome email.</b> The subject or the body is empty, so the API sends its built-in message instead. Fill in both to
            send your own.
          </>
        ) : (
          <>
            <b>This list sends your own welcome email.</b> It goes out right after someone confirms. If you clear the subject or the body, the default
            welcome email is sent instead.
          </>
        )}
      </Callout>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="flex min-w-0 flex-col gap-4 p-3.5">
          <Field id="we-subject" label="Subject" hint="Leave empty to use the default.">
            <Input
              id="we-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Welcome to the list"
              autoComplete="off"
              className="h-8 bg-panel"
            />
          </Field>
          <Field id="we-body" label="Body (HTML)" hint="Plain HTML. Leave empty to use the default.">
            <Textarea
              id="we-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="<p>Thanks for confirming.</p>"
              spellCheck={false}
              rows={14}
              className="min-h-64 bg-panel font-mono text-[12px] leading-relaxed"
            />
          </Field>
          <div className="flex items-center justify-end gap-2">
            {dirty && <span className="mr-auto text-xs text-warning">Unsaved changes</span>}
            <Btn
              onClick={() => {
                setSubject(list.welcome_subject);
                setBody(list.welcome_body);
              }}
              disabled={!dirty || saving}
            >
              Revert
            </Btn>
            <Btn variant="primary" onClick={save} disabled={!dirty || saving}>
              {saving ? "Saving…" : "Save"}
              {!saving && <Kbd onAccent className="max-sm:hidden">{modKey} S</Kbd>}
            </Btn>
          </div>
        </Panel>

        <Panel className="flex min-w-0 flex-col overflow-hidden">
          <PanelHeader title="Preview" sub="as typed, not yet saved" />
          <dl className="m-0 grid grid-cols-[3.5rem_1fr] gap-x-2 gap-y-0.5 border-b border-line-2 px-3.5 py-2.5 text-xs">
            <dt className="text-faint">From</dt>
            <dd className="m-0 truncate">
              {list.sender_name ? `${list.sender_name} ` : ""}
              {list.sender_email ? `<${list.sender_email}>` : "—"}
            </dd>
            <dt className="text-faint">Subject</dt>
            <dd className="m-0 truncate font-medium">{subject.trim() || <span className="font-normal text-faint">(default subject)</span>}</dd>
          </dl>
          {body.trim() ? (
            <iframe title="Welcome email preview" sandbox="" srcDoc={emailDoc(body)} className="block min-h-72 w-full flex-1 border-0 bg-panel" />
          ) : (
            <p className="flex-1 p-4 text-xs text-faint">Nothing to preview. With an empty body, subscribers get the default welcome email.</p>
          )}
        </Panel>
      </div>
      {guard}
    </div>
  );
}
