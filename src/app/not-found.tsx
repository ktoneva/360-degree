import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">Page not found</h1>
      <p className="mt-2 text-sm text-zinc-600">
        That page doesn&apos;t exist. If you followed a link, double-check it&apos;s correct.
      </p>
      <Link
        href="/admin"
        className="mt-6 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        Go to review cycles
      </Link>
    </div>
  );
}
