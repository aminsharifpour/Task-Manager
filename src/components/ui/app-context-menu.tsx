import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AppContextMenuItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  tone?: "default" | "danger";
  disabled?: boolean;
  onSelect: () => void;
};

type AppContextMenuProps = {
  open: boolean;
  x: number;
  y: number;
  title?: string;
  items: AppContextMenuItem[];
  onClose: () => void;
};

const MENU_WIDTH = 248;
const MENU_MARGIN = 12;

export function AppContextMenu({ open, x, y, title, items, onClose }: AppContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const onContextMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const onViewportChange = () => onClose();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [onClose, open]);

  const menuPosition = useMemo(() => {
    if (typeof window === "undefined") return { left: x, top: y };
    const maxLeft = Math.max(MENU_MARGIN, window.innerWidth - MENU_WIDTH - MENU_MARGIN);
    const left = Math.min(Math.max(MENU_MARGIN, x), maxLeft);
    const top = Math.min(Math.max(MENU_MARGIN, y), window.innerHeight - MENU_MARGIN);
    return { left, top };
  }, [x, y]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      dir="rtl"
      className="app-context-menu fixed z-[120] w-[248px] origin-top-right rounded-xl border border-border/80 bg-background/95 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95"
      style={menuPosition}
    >
      {title ? <p className="px-2 pb-1 pt-1 text-xs font-semibold text-muted-foreground">{title}</p> : null}
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={cn(
                "app-context-menu-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-right text-sm transition-colors",
                item.disabled ? "cursor-not-allowed opacity-50" : "hover:bg-muted/60",
                item.tone === "danger" ? "text-destructive" : "text-foreground",
              )}
              onClick={() => {
                if (item.disabled) return;
                onClose();
                item.onSelect();
              }}
            >
              {Icon ? <Icon className="app-context-menu-icon h-4 w-4 shrink-0" /> : null}
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
