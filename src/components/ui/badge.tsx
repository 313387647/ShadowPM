import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-transparent px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors [&>svg]:pointer-events-none [&>svg]:size-3 shrink-0",
  {
    variants: {
      variant: {
        default: "border-primary/25 bg-primary/15 text-primary hover:bg-primary/20",
        secondary:
          "border-border bg-secondary text-secondary-foreground hover:bg-surface-3",
        destructive:
          "border-destructive/25 bg-destructive/10 text-destructive",
        outline: "border-border bg-canvas/20 text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
