import { Panel, PanelHeader } from "@/components/Panel";
import { CopyButton } from "@/components/CopyButton";
import { embedSnippet, collectorUrl, type MailList } from "@/lib/api";

/** Static, script-free rendering of the form part of the snippet. White page on purpose: it shows the unstyled form as a site would. */
function previewDoc(snippet: string): string {
  const form = snippet.split("<script>")[0];
  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:20px;background:#fff;color:#1b1b1a;font:14px/1.5 system-ui,sans-serif}
input[type=email]{padding:6px 8px;font:inherit;margin-right:6px}button{padding:6px 12px;font:inherit}
</style>${form}`;
}

function Row({ label, value, what }: { label: string; value: string; what: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-line-2 px-3.5 py-2.5 last:border-b-0">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <code className="min-w-0 flex-1 truncate font-mono text-[11.5px]" title={value}>
        {value}
      </code>
      <CopyButton text={value} what={what} />
    </div>
  );
}

/** List → Form & embed. */
export function EmbedTab({ list }: { list: MailList }) {
  const endpoint = `${collectorUrl()}/v1/subscribe`;
  const snippet = embedSnippet(collectorUrl(), list.list_key);
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <Panel className="min-w-0 lg:row-span-2">
        <PanelHeader title="Embed snippet" sub="paste into your page's HTML">
          <CopyButton text={snippet} what="Snippet" label="Copy snippet" />
        </PanelHeader>
        <pre
          tabIndex={0}
          aria-label="Embed snippet"
          className="m-0 max-h-[34rem] overflow-auto p-3.5 font-mono text-[11.5px] leading-relaxed"
        >
          <code>{snippet}</code>
        </pre>
      </Panel>

      <div className="flex min-w-0 flex-col gap-4">
        <Panel>
          <PanelHeader title="Preview" sub="the form, with no site CSS" />
          <iframe
            title={`Preview of the ${list.name} signup form`}
            sandbox=""
            srcDoc={previewDoc(snippet)}
            className="block h-28 w-full rounded-b-[10px] border-0 bg-panel"
          />
        </Panel>

        <Panel>
          <PanelHeader title="Connection" />
          <Row label="Endpoint" value={endpoint} what="Endpoint" />
          <Row label="List key" value={list.list_key} what="List key" />
        </Panel>

        <Panel>
          <PanelHeader title="Good to know" />
          <ul className="m-0 flex list-none flex-col gap-2.5 p-3.5 text-xs leading-relaxed text-muted-foreground">
            <li>
              <b className="font-medium text-foreground">Honeypot.</b> The hidden <code className="font-mono text-[11.5px]">website</code> field must stay
              empty. Bots fill it in and are dropped; real visitors never see it. Keep it in your own markup.
            </li>
            <li>
              <b className="font-medium text-foreground">Source.</b> The snippet sends <code className="font-mono text-[11.5px]">metadata.source</code> as the
              page path. It appears in the Source column and the contact panel. Add your own keys (utm_campaign, ref) to the same JSON.
            </li>
            <li>
              <b className="font-medium text-foreground">Double opt-in.</b> New signups are pending until they click the link in the confirmation email.
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
