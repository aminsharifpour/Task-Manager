import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { Button as HeroButton } from "@heroui/react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground",
        destructive:
          "bg-destructive text-destructive-foreground",
        outline:
          "border border-input bg-background hover:bg-muted/60",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-muted/60",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-8",
        icon: "h-9 w-9 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    if (asChild) {
      const Comp = Slot
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        />
      )
    }

    const heroVariant =
      variant === "default"
        ? "primary"
        : variant === "destructive"
          ? "danger"
          : variant === "outline"
            ? "outline"
            : variant === "secondary"
              ? "secondary"
              : variant === "ghost"
                ? "ghost"
                : "tertiary"

    const heroSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "md"
    const heroProps = props as unknown as React.ComponentProps<typeof HeroButton>

    return (
      <HeroButton
        className={cn(
          buttonVariants({ variant, size }),
          variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
          size === "icon" && "w-9 min-w-9 px-0",
          className
        )}
        ref={ref}
        variant={heroVariant}
        size={heroSize}
        {...heroProps}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
