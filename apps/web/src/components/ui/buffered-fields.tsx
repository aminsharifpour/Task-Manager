import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function BufferedInput({
  value,
  onCommit,
  normalize,
  commitOnEnter = true,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange"> & {
  value: string;
  onCommit: (value: string) => void;
  normalize?: (value: string) => string;
  commitOnEnter?: boolean;
}) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const commitValue = () => {
    const next = normalize ? normalize(localValue) : localValue;
    if (next !== localValue) setLocalValue(next);
    if (next !== value) onCommit(next);
  };

  return (
    <Input
      {...props}
      value={localValue}
      onChange={(e) => {
        const raw = e.currentTarget.value;
        setLocalValue(normalize ? normalize(raw) : raw);
      }}
      onBlur={(e) => {
        props.onBlur?.(e);
        commitValue();
      }}
      onKeyDown={(e) => {
        props.onKeyDown?.(e);
        if (!e.defaultPrevented && commitOnEnter && e.key === "Enter") {
          commitValue();
        }
      }}
    />
  );
}

export function BufferedTextarea({
  value,
  onCommit,
  normalize,
  ...props
}: Omit<ComponentProps<typeof Textarea>, "value" | "defaultValue" | "onChange"> & {
  value: string;
  onCommit: (value: string) => void;
  normalize?: (value: string) => string;
}) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const commitValue = () => {
    const next = normalize ? normalize(localValue) : localValue;
    if (next !== localValue) setLocalValue(next);
    if (next !== value) onCommit(next);
  };

  return (
    <Textarea
      {...props}
      value={localValue}
      onChange={(e) => {
        const raw = e.currentTarget.value;
        setLocalValue(normalize ? normalize(raw) : raw);
      }}
      onBlur={(e) => {
        props.onBlur?.(e);
        commitValue();
      }}
    />
  );
}
