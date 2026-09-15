/** Downloads the server-rendered PDF rather than the browser's own print
 * dialog -- a plain link is enough, the Content-Disposition header on the
 * response is what triggers the download. */
export function PrintButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="print:hidden rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
    >
      Download as PDF
    </a>
  );
}
