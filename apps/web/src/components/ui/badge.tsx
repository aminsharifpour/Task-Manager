import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-[0.72rem] font-medium tracking-[-0.01em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-primary/12 bg-primary/10 text-primary hover:bg-primary/14",
        secondary:
          "border-border/70 bg-muted/60 text-foreground hover:bg-muted/80",
        destructive:
          "border-destructive/15 bg-destructive/10 text-destructive hover:bg-destructive/14",
        outline: "border-border/80 bg-background text-foreground hover:bg-muted/40",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
