"use client";

import { useRef, useState } from "react";

export function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const fallbackRef = useRef<HTMLInputElement>(null);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be denied or unavailable; fall back to a
      // selectable field the admin can copy manually.
      setShowFallback(true);
      requestAnimationFrame(() => fallbackRef.current?.select());
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
      {showFallback && (
        <input
          ref={fallbackRef}
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="w-48 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
        />
      )}
    </div>
  );
}
