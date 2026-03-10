import { useCallback, useEffect, useRef, useState } from "react";

export type VirtualWindow = {
  start: number;
  end: number;
  paddingTop: number;
  paddingBottom: number;
};

const DEFAULT_WINDOW = 80;
const DEFAULT_OVERSCAN_ROWS = 10;
const EMPTY_WINDOW: VirtualWindow = { start: 0, end: DEFAULT_WINDOW, paddingTop: 0, paddingBottom: 0 };

const computeVirtualWindow = (
  totalRows: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
  overscanRows = DEFAULT_OVERSCAN_ROWS,
): VirtualWindow => {
  if (totalRows <= 0) return EMPTY_WINDOW;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscanRows);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscanRows * 2;
  const end = Math.min(totalRows, start + Math.max(visibleCount, DEFAULT_WINDOW));
  return {
    start,
    end,
    paddingTop: start * rowHeight,
    paddingBottom: Math.max(0, (totalRows - end) * rowHeight),
  };
};

export const useVirtualRows = (totalRows: number, rowHeight: number, active: boolean, overscanRows = DEFAULT_OVERSCAN_ROWS) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [windowState, setWindowState] = useState<VirtualWindow>(EMPTY_WINDOW);

  const recalc = useCallback(() => {
    const node = ref.current;
    if (!node || !active || totalRows <= 0) {
      setWindowState(EMPTY_WINDOW);
      return;
    }
    const next = computeVirtualWindow(totalRows, rowHeight, node.scrollTop, node.clientHeight || 0, overscanRows);
    setWindowState((prev) =>
      prev.start === next.start &&
      prev.end === next.end &&
      prev.paddingTop === next.paddingTop &&
      prev.paddingBottom === next.paddingBottom
        ? prev
        : next,
    );
  }, [active, overscanRows, rowHeight, totalRows]);

  const onScroll = useCallback(() => {
    recalc();
  }, [recalc]);

  useEffect(() => {
    if (!active) return;
    recalc();
    const onResize = () => recalc();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [active, recalc]);

  useEffect(() => {
    if (!active) return;
    recalc();
  }, [active, recalc, totalRows]);

  return { ref, onScroll, windowState, recalc };
};
