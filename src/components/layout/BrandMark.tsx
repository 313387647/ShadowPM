import { Layers3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return <span className={cn("grid size-8 place-items-center rounded-md border border-border bg-surface-2 text-foreground", className)} aria-hidden="true"><Layers3 className="size-[18px] stroke-[1.7]" /></span>;
}
