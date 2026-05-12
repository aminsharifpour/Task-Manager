import * as React from "react";

import { cn } from "@/lib/utils";

type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
};

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, options, placeholder, value, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "oneui-native-select flex h-11 w-full rounded-xl border border-foreground/8 bg-[linear-gradient(180deg,hsl(var(--card)),hsl(var(--muted)/0.38))] px-3.5 py-2 text-sm text-foreground ring-offset-background transition-colors shadow-[inset_0_1px_0_hsl(0_0%_100%/0.32),0_0_0_1px_hsl(var(--foreground)/0.02)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      value={value ?? ""}
      {...props}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  ),
);

NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
