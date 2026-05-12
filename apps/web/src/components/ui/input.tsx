import * as React from "react"
import { Input as HeroInput } from "@heroui/react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
        <HeroInput
          type={type}
          variant="primary"
          className={cn(
          "oneui-input min-h-11",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
