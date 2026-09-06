import Link from "next/link";
import { NewCycleForm } from "./new-cycle-form";

export default function NewCyclePage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-700">
        &larr; Back to review cycles
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold text-zinc-900">New review cycle</h1>
      <NewCycleForm />
    </div>
  );
}
