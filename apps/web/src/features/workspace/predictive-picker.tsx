import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Page, Request } from "./use-module";
import "./predictive-picker.css";

export type PickerResource = "members" | "projects" | "tasks" | "chat/conversations";
export type PickerRow = {
  id?: string; userId?: string; name?: string; title?: string;
  role?: string; status?: string; user?: { fullName: string; isActive?: boolean };
};
export type PickerOption = { id: string; name: string };
export type PredictivePickerProps = {
  api: Request;
  resource: PickerResource;
  label: string;
  value: string;
  onChange: (value: string) => void;
  projectId?: string;
  excludeId?: string;
  includeGuests?: boolean;
  activeOnly?: boolean;
  hideClosedProjects?: boolean;
  hideCompletedTasks?: boolean;
  required?: boolean;
  disabled?: boolean;
  selfId?: string;
  selfLabel?: string;
  currentLabel?: string;
};

export function normalizePickerText(value: string) {
  return value.normalize("NFKC").replace(/ي/g, "ی").replace(/ك/g, "ک")
    .replace(/[\u200c\u200e\u200f]/g, " ").trim().toLocaleLowerCase("fa");
}

/** Filtering is also enforced by the API on writes; this never grants permissions. */
export function pickerOptions(rows: PickerRow[], props: Pick<PredictivePickerProps,
  "resource" | "excludeId" | "includeGuests" | "activeOnly" | "hideClosedProjects" | "hideCompletedTasks">): PickerOption[] {
  const seen = new Set<string>();
  return rows.flatMap(row => {
    const id = row.userId || row.id;
    if (!id || seen.has(id) || id === props.excludeId) return [];
    if (props.resource === "members" && (
      (!props.includeGuests && row.role === "guest") ||
      row.status === "revoked" || row.status === "inactive" || row.user?.isActive === false
    )) return [];
    if (props.activeOnly && row.status !== "active") return [];
    if (props.hideClosedProjects && ["completed", "archived"].includes(row.status || "")) return [];
    if (props.hideCompletedTasks && row.status === "done") return [];
    seen.add(id);
    return [{ id, name: row.user?.fullName || row.name || row.title || "بدون عنوان" }];
  });
}

export function pickerPath(resource: PickerResource, query: string, page: number, projectId = "") {
  const params = new URLSearchParams({ page: String(page), pageSize: "25", search: query.trim() });
  if (projectId) params.set("projectId", projectId);
  return "/" + resource + "?" + params.toString();
}

/**
 * One input for both searching and selecting an existing record.
 * It deliberately stays inside the owning dialog's focus/scroll boundary.
 */
export default function PredictivePicker(props: PredictivePickerProps) {
  const {
    api, resource, label, value, onChange, projectId = "", excludeId = "",
    includeGuests = false, activeOnly = false, hideClosedProjects = false,
    hideCompletedTasks = false, required = false, disabled = false,
    selfId = "", selfLabel = "خودم", currentLabel = "گزینه انتخاب‌شده",
  } = props;
  const id = useId(), input = useRef<HTMLInputElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const scope = JSON.stringify([resource, projectId, excludeId, includeGuests, activeOnly, hideClosedProjects, hideCompletedTasks, selfId]);
  const lastScope = useRef(scope), lastValue = useRef(value);
  const chosen = useRef<PickerOption | null>(value ? { id: value, name: value === selfId ? selfLabel : currentLabel } : null);
  const generation = useRef(0);
  const [text, setText] = useState(chosen.current?.name || "");
  const [request, setRequest] = useState({ query: "", page: 1 });
  const [result, setResult] = useState<{ key: string; rows: PickerRow[]; total: number; page: number; pageSize: number }>({
    key: "", rows: [], total: 0, page: 0, pageSize: 25,
  });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [retry, setRetry] = useState(0), [active, setActive] = useState(-1);
  const [invalid, setInvalid] = useState(false);
  const resultKey = scope + "\n" + request.query;

  useEffect(() => {
    if (lastScope.current !== scope) {
      lastScope.current = scope;
      lastValue.current = "";
      chosen.current = null;
      setText(""); setRequest({ query: "", page: 1 }); setActive(-1);
      if (value) onChange("");
    }
  }, [scope, value, onChange]);

  useEffect(() => {
    if (lastValue.current === value) return;
    lastValue.current = value;
    const labelForValue = value === selfId ? selfLabel
      : chosen.current?.id === value ? chosen.current.name : currentLabel;
    chosen.current = value ? { id: value, name: labelForValue } : null;
    setText(chosen.current?.name || "");
    setRequest({ query: "", page: 1 }); setActive(-1); setInvalid(false);
  }, [value, currentLabel, selfId, selfLabel]);


  useEffect(() => {
    const field = input.current;
    if (!field) return;
    field.setCustomValidity(!disabled && !value && text.trim()
      ? "یک گزینه معتبر از پیشنهادها انتخاب کنید." : "");
  }, [value, text, disabled]);

  useEffect(() => {
    if (!open || disabled) { setLoading(false); return; }
    const controller = new AbortController();
    const token = ++generation.current;
    setLoading(true); setError("");
    const timer = window.setTimeout(() => {
      void api<Page<PickerRow>>(pickerPath(resource, request.query, request.page, projectId), { signal: controller.signal })
        .then(page => {
          if (controller.signal.aborted || token !== generation.current) return;
          setResult(previous => ({
            key: resultKey,
            rows: request.page > 1 && previous.key === resultKey
              ? [...previous.rows, ...page.items] : page.items,
            total: page.total, page: page.page, pageSize: page.pageSize,
          }));
        })
        .catch(reason => {
          if (!controller.signal.aborted && token === generation.current)
            setError(reason instanceof Error ? reason.message : "دریافت پیشنهادها انجام نشد.");
        })
        .finally(() => {
          if (!controller.signal.aborted && token === generation.current) setLoading(false);
        });
    }, request.query ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [api, resource, projectId, resultKey, request.query, request.page, retry, open, disabled]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const options = pickerOptions(result.key === resultKey ? result.rows : [], {
    resource, excludeId, includeGuests, activeOnly, hideClosedProjects, hideCompletedTasks,
  });
  if (selfId && selfId !== excludeId && !options.some(row => row.id === selfId)
    && (!request.query || normalizePickerText(selfLabel).includes(normalizePickerText(request.query))))
    options.unshift({ id: selfId, name: selfLabel });
  const hasMore = result.key === resultKey && result.page * result.pageSize < result.total;
  const waiting = loading && request.page === 1;

  useEffect(() => {
    if (!value || request.query) return;
    const found = options.find(row => row.id === value);
    if (found && found.name !== chosen.current?.name) {
      chosen.current = found; setText(found.name);
    }
  }, [result, value, request.query]); // Resolved labels survive subsequent searches/pages.

  useEffect(() => {
    if (active >= 0 && open)
      document.getElementById(id + "-option-" + active)?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);

  const select = (option: PickerOption) => {
    if (disabled || input.current?.matches(":disabled")) return;
    chosen.current = option; lastValue.current = option.id;
    setText(option.name); setRequest({ query: "", page: 1 });
    setOpen(false); setActive(-1); setInvalid(false); onChange(option.id);
    input.current?.setCustomValidity(""); input.current?.focus();
  };
  const clear = () => {
    if (disabled || input.current?.matches(":disabled")) return;
    chosen.current = null; lastValue.current = "";
    setText(""); setRequest({ query: "", page: 1 });
    setActive(-1); setInvalid(false); onChange(""); input.current?.focus();
  };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled || event.nativeEvent.isComposing) return;
    if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); setActive(-1); return;
    }
    if (event.key === "Tab") { setOpen(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); setOpen(true);
      if (options.length && !waiting) setActive(index => event.key === "ArrowDown"
        ? Math.min(index + 1, options.length - 1) : index < 0 ? options.length - 1 : Math.max(0, index - 1));
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      if (!waiting && active >= 0 && options[active]) select(options[active]);
    }
  };

  return (
    <div ref={container} className="predictive-picker" data-disabled={disabled || undefined}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
      <label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
      <div className="predictive-picker-control">
        <input ref={input} id={id} type="text" role="combobox" autoComplete="off"
          aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={open}
          aria-controls={open ? id + "-list" : undefined}
          aria-activedescendant={open && !waiting && active >= 0 && options[active] ? id + "-option-" + active : undefined}
          aria-required={required} aria-invalid={invalid || undefined}
          aria-describedby={id + "-help"} required={required} disabled={disabled}
          value={text} maxLength={200} placeholder="نام را تایپ کنید و از پیشنهادها انتخاب کنید…"
          onInvalid={() => { setInvalid(true); setOpen(true); }}
          onKeyDown={keyDown}
          onChange={event => {
            const next = event.target.value;
            setText(next); setRequest({ query: next, page: 1 }); setOpen(true); setActive(-1); setInvalid(false);
            chosen.current = null;
            if (value) { lastValue.current = ""; onChange(""); }
          }} />
        {(value || text) && <button type="button" className="predictive-picker-clear"
          aria-label={"پاک کردن " + label} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={clear}>×</button>}
        <button type="button" className="predictive-picker-toggle" tabIndex={-1}
          aria-label={"نمایش پیشنهادهای " + label} disabled={disabled}
          onMouseDown={event => event.preventDefault()}
          onClick={() => { input.current?.focus(); setOpen(previous => !previous); setActive(-1); }}>⌄</button>
      </div>
      {open && !disabled && (
        <div className="predictive-picker-popup">
          <div id={id + "-list"} role="listbox" aria-label={"پیشنهادهای " + label} aria-busy={loading}
            className="predictive-picker-list">
            {!waiting && options.map((option, index) => (
              <button type="button" key={option.id} role="option" tabIndex={-1}
                id={id + "-option-" + index} aria-selected={value === option.id}
                data-active={index === active || undefined}
                onMouseDown={event => event.preventDefault()} onMouseMove={() => setActive(index)}
                onClick={() => select(option)}>{option.name}</button>
            ))}
          </div>
          <div className="predictive-picker-status" role="status" aria-live="polite">
            {loading ? "در حال دریافت پیشنهادها…" : error ? ""
              : options.length ? new Intl.NumberFormat("fa").format(options.length) + " گزینه قابل انتخاب"
              : "گزینه‌ای پیدا نشد؛ عبارت دیگری جستجو کنید."}
          </div>
          {error && <div className="predictive-picker-error"><span role="alert">{error}</span>
            <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => setRetry(n => n + 1)}>تلاش دوباره</button></div>}
          {hasMore && <button type="button" className="predictive-picker-more" disabled={loading || Boolean(error)}
            onMouseDown={event => event.preventDefault()}
            onClick={() => { setActive(-1); setRequest(previous => ({ ...previous, page: previous.page + 1 })); }}>نمایش موارد بیشتر</button>}
        </div>
      )}
      <small id={id + "-help"} className={invalid ? "predictive-picker-error" : "predictive-picker-help"}>
        {invalid ? "از فهرست پیشنهادها یک گزینه انتخاب کنید." : "جستجو و انتخاب در همین کادر"}
      </small>
    </div>
  );
}
