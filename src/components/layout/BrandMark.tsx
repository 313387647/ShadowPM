import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return <span className={cn("grid size-8 place-items-center rounded-md border border-border bg-surface-2 text-foreground", className)} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 6.5 7-3.5 7 3.5v8L12 21l-7-3.5z" />
      <path d="m7.5 8.25 4.5-2.2 4.5 2.2L12 10.5z" fill="currentColor" stroke="none" opacity=".92" />
      <path d="m7.5 11.4 4.5 2.25 4.5-2.25M7.5 14.5 12 16.75l4.5-2.25" />
    </svg>
  </span>;
}
