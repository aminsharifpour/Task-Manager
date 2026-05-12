import { useEffect, useRef, useState } from "react";

type Serializer<T> = {
  parse: (raw: string) => T;
  stringify: (value: T) => string;
};

const stringSerializer: Serializer<string> = {
  parse: (raw) => raw,
  stringify: (value) => value,
};

const literalStringSerializer = <T extends string>(allowed: readonly T[], fallback: T): Serializer<T> => ({
  parse: (raw) => (allowed.includes(raw as T) ? (raw as T) : fallback),
  stringify: (value) => value,
});

const booleanFlagSerializer: Serializer<boolean> = {
  parse: (raw) => raw === "1" || raw === "true",
  stringify: (value) => (value ? "1" : "0"),
};

const jsonSerializer = <T,>(): Serializer<T> => ({
  parse: (raw) => JSON.parse(raw) as T,
  stringify: (value) => JSON.stringify(value),
});

const isBrowser = () => typeof window !== "undefined";

export function readUiPreference<T>(key: string, fallback: T, serializer: Serializer<T>): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return serializer.parse(raw);
  } catch {
    return fallback;
  }
}

export function useUiPreference<T>(key: string, fallback: T, serializer: Serializer<T>) {
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;
  const serializerRef = useRef(serializer);
  serializerRef.current = serializer;
  const [value, setValue] = useState<T>(() => readUiPreference(key, fallback, serializer));

  useEffect(() => {
    setValue(readUiPreference(key, fallbackRef.current, serializerRef.current));
  }, [key]);

  useEffect(() => {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(key, serializerRef.current.stringify(value));
    } catch {
      // ignore persistence failures
    }
  }, [key, value]);

  return [value, setValue] as const;
}

export const uiPreferenceSerializers = {
  string: stringSerializer,
  booleanFlag: booleanFlagSerializer,
  json: jsonSerializer,
  literalString: literalStringSerializer,
};
