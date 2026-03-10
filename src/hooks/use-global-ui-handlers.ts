import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { AppContextMenuItem } from "@/components/ui/app-context-menu";

type ContextMenuState = {
  open: boolean;
  x: number;
  y: number;
  title: string;
  items: AppContextMenuItem[];
};

export const useGlobalUiHandlers = ({
  pushToast,
}: {
  pushToast: (message: string, tone?: "success" | "error") => void;
}) => {
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    destructive: boolean;
  }>({
    open: false,
    title: "تایید عملیات",
    message: "",
    confirmLabel: "تایید",
    destructive: false,
  });
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    open: false,
    x: 0,
    y: 0,
    title: "",
    items: [],
  });

  const closeConfirmDialog = (result: boolean) => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(result);
      confirmResolverRef.current = null;
    }
    setConfirmDialog((prev) => ({ ...prev, open: false }));
  };

  const confirmAction = async (
    message: string,
    options?: { title?: string; confirmLabel?: string; destructive?: boolean },
  ) =>
    new Promise<boolean>((resolve) => {
      if (confirmResolverRef.current) confirmResolverRef.current(false);
      confirmResolverRef.current = resolve;
      setConfirmDialog({
        open: true,
        title: options?.title ?? "تایید عملیات",
        message,
        confirmLabel: options?.confirmLabel ?? "تایید",
        destructive: options?.destructive ?? false,
      });
    });

  const closeContextMenu = () => {
    setContextMenu((prev) => (prev.open ? { ...prev, open: false } : prev));
  };

  const openContextMenu = (event: ReactMouseEvent, title: string, items: AppContextMenuItem[]) => {
    event.preventDefault();
    event.stopPropagation();
    const activeItems = items.filter((item) => !item.disabled);
    if (activeItems.length === 0) return;
    setContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      title,
      items: activeItems,
    });
  };

  const copyTextToClipboard = async (text: string, successMessage = "متن کپی شد.") => {
    const value = text.trim();
    if (!value) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        throw new Error("Clipboard API unavailable");
      }
      pushToast(successMessage);
    } catch {
      pushToast("کپی متن در این دستگاه در دسترس نیست.", "error");
    }
  };

  return {
    confirmDialog,
    contextMenu,
    closeConfirmDialog,
    confirmAction,
    closeContextMenu,
    openContextMenu,
    copyTextToClipboard,
  };
};
