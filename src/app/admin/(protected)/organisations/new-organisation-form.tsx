"use client";

import { useActionState, useEffect, useRef } from "react";
import { createOrganisation } from "@/app/admin/actions";
import { initialActionState } from "@/lib/action-state";

export function NewOrganisationForm() {
  const [state, formAction, pending] = useActionState(createOrganisation, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.successCount > 0) {
      formRef.current?.reset();
    }
  }, [state.successCount]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="org_name" className="block text-xs font-medium text-zinc-700">
            Organisation name
          </label>
          <input
            id="org_name"
            name="name"
            required
            className="mt-1 w-56 rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
            placeholder="Eastgate Academy"
          />
        </div>
        <div>
          <label htmlFor="org_contact_name" className="block text-xs font-medium text-zinc-700">
            Contact name
          </label>
          <input
            id="org_contact_name"
            name="contact_name"
            className="mt-1 w-48 rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="org_contact_email" className="block text-xs font-medium text-zinc-700">
            Contact email
          </label>
          <input
            id="org_contact_email"
            name="contact_email"
            type="email"
            className="mt-1 w-56 rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add organisation"}
        </button>
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
