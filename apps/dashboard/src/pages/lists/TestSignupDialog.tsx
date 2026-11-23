import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Btn, LinkBtn } from "@/components/Btn";
import { Field } from "@/components/Field";
import type { MailList } from "@/lib/api";
import { useTestSignup } from "@/lib/queries";
import { paths } from "@/lib/routes";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Form({ list, onClose }: { list: MailList; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ status: string; email: string } | null>(null);
  const signup = useTestSignup();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!EMAIL.test(v)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    try {
      const res = await signup.mutateAsync({ listKey: list.list_key, email: v });
      setResult({ status: res.status, email: v });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The signup failed.");
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 px-5 pb-5">
      <Field
        id="ts-email"
        label="Email address"
        error={error}
        hint="Goes through the same public endpoint as your form, tagged source “dashboard-test”."
      >
        <Input
          id="ts-email"
          type="email"
          autoFocus
          autoComplete="off"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setResult(null);
          }}
          placeholder="you@example.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "ts-email-error" : "ts-email-hint"}
          className="h-8 bg-panel"
        />
      </Field>
      {result && (
        <p role="status" className="rounded-lg bg-success-soft px-3 py-2 text-xs">
          {result.status === "confirmed"
            ? `${result.email} is already confirmed on this list.`
            : `${result.email} is now pending. A confirmation email was sent if mail is configured; you can also confirm it by hand from its contact panel.`}{" "}
          <LinkBtn to={paths.contact(list.list_key, result.email)} variant="ghost" size="sm" onClick={onClose} className="-my-1 text-brand">
            Open contact
          </LinkBtn>
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Btn onClick={onClose}>{result ? "Done" : "Cancel"}</Btn>
        <Btn type="submit" variant="primary" disabled={signup.isPending}>
          {signup.isPending ? "Sending…" : "Send test signup"}
        </Btn>
      </div>
    </form>
  );
}

export function TestSignupDialog({ list, open, onOpenChange }: { list: MailList; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="gap-0 bg-panel p-0 pt-5 sm:max-w-md">
        <div className="mb-4 space-y-1 px-5">
          <DialogTitle className="text-sm font-semibold">Test signup</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Sign an address up to “{list.name}” to try the double opt-in flow end to end.
          </DialogDescription>
        </div>
        {open && <Form list={list} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
