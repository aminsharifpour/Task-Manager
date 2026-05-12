import * as React from "react"
import { TextArea as HeroTextArea } from "@heroui/react"

import { cn } from "@/lib/utils"

type TextareaProps = React.ComponentProps<"textarea">

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    const heroProps = props as unknown as React.ComponentProps<typeof HeroTextArea>

    return (
      <HeroTextArea
        ref={ref}
        variant="primary"
        className={cn("oneui-textarea min-h-[7.5rem]", className)}
        {...heroProps}
      />
    )
  }
)

Textarea.displayName = "Textarea"

export { Textarea }
