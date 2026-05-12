import * as React from "react"
import { Checkbox as HeroCheckbox } from "@heroui/react"

import { cn } from "@/lib/utils"

type CheckedState = boolean | "indeterminate"

type CheckboxProps = Omit<
  React.ComponentProps<typeof HeroCheckbox>,
  "isSelected" | "defaultSelected" | "isIndeterminate" | "onChange"
> & {
  checked?: CheckedState
  defaultChecked?: CheckedState
  onCheckedChange?: (checked: CheckedState) => void
}

const Checkbox = React.forwardRef<HTMLLabelElement, CheckboxProps>(
  ({ className, checked, defaultChecked, onCheckedChange, children, ...props }, ref) => {
    const heroProps = props as unknown as React.ComponentProps<typeof HeroCheckbox>

    return (
      <HeroCheckbox
        ref={ref}
        className={cn(
          "oneui-checkbox text-sm",
          className
        )}
        isSelected={checked === true}
        defaultSelected={defaultChecked === true}
        isIndeterminate={checked === "indeterminate" || defaultChecked === "indeterminate"}
        variant="primary"
        onChange={(isSelected) => onCheckedChange?.(isSelected)}
        {...heroProps}
      >
        {children}
      </HeroCheckbox>
    )
  }
)

Checkbox.displayName = "Checkbox"

export { Checkbox }
