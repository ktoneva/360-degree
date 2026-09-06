import Link from "next/link";

export default function CycleNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">Review cycle not found</h1>
      <p className="mt-2 text-sm text-zinc-600">
        This review cycle doesn&apos;t exist — it may have been deleted, or the link is wrong.
      </p>
      <Link
        href="/admin"
        className="mt-6 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        Back to review cycles
      </Link>
    </div>
  );
}
