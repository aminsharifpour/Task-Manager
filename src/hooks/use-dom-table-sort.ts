import { useEffect, useMemo, useRef } from "react";

export type TableSortDirection = "asc" | "desc";

const normalizeDigits = (value: string) =>
  String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));

const normalizeSortableText = (value: string) =>
  normalizeDigits(String(value ?? ""))
    .replace(/\u200c/g, "")
    .replace(/\s+/g, " ")
    .trim();

const parseSortableValue = (value: string): number | string => {
  const cleaned = normalizeSortableText(value).replace(/[,\u066C\u060C]/g, "");
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
  if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cleaned)) {
    const date = new Date(cleaned.replace(/\//g, "-"));
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return cleaned.toLocaleLowerCase("fa");
};

export const compareSortableValues = (left: string, right: string) => {
  const a = parseSortableValue(left);
  const b = parseSortableValue(right);
  if (typeof a === "number" && typeof b === "number") {
    if (a === b) return 0;
    return a > b ? 1 : -1;
  }
  return String(a).localeCompare(String(b), "fa");
};

export const useDomTableSort = () => {
  const tableSortStateRef = useRef<Map<string, { columnIndex: number; direction: TableSortDirection }>>(new Map());

  const getTableSortKey = useMemo(
    () => (table: HTMLTableElement) => {
      const explicit = String(table.getAttribute("data-sort-key") ?? "").trim();
      if (explicit) return explicit;
      const tables = Array.from(document.querySelectorAll("main.app-shell table"));
      const idx = tables.indexOf(table);
      return idx >= 0 ? `idx-${idx}` : "idx-unknown";
    },
    [],
  );

  useEffect(() => {
    const applySortIndicators = (table: HTMLTableElement, columnIndex: number, direction: TableSortDirection) => {
      const headerCells = Array.from(table.querySelectorAll("thead th"));
      headerCells.forEach((cell, idx) => {
        if (!(cell instanceof HTMLElement)) return;
        cell.style.cursor = "pointer";
        if (idx === columnIndex) {
          cell.setAttribute("aria-sort", direction === "asc" ? "ascending" : "descending");
          cell.setAttribute("data-sort-direction", direction);
        } else {
          cell.removeAttribute("aria-sort");
          cell.removeAttribute("data-sort-direction");
        }
      });
    };

    const sortTableDom = (table: HTMLTableElement, columnIndex: number, direction: TableSortDirection) => {
      const tbody = table.querySelector("tbody");
      if (!tbody) return;
      const rows = Array.from(tbody.querySelectorAll(":scope > tr"));
      const sortableRows = rows.filter((row) => row.querySelectorAll("td").length > columnIndex);
      const fixedRows = rows.filter((row) => !sortableRows.includes(row));
      sortableRows.sort((rowA, rowB) => {
        const cellA = rowA.querySelectorAll("td")[columnIndex];
        const cellB = rowB.querySelectorAll("td")[columnIndex];
        const textA = cellA?.textContent ?? "";
        const textB = cellB?.textContent ?? "";
        const result = compareSortableValues(textA, textB);
        return direction === "asc" ? result : -result;
      });
      tbody.replaceChildren(...fixedRows, ...sortableRows);
      applySortIndicators(table, columnIndex, direction);
    };

    const root = document.querySelector("main.app-shell");
    if (!root) return;

    const clickHandler = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const th = target?.closest("th");
      if (!th) return;
      const table = th.closest("table");
      if (!(table instanceof HTMLTableElement)) return;
      if (table.getAttribute("data-disable-dom-sort") === "true") return;
      const headerCells = Array.from(table.querySelectorAll("thead th"));
      const columnIndex = headerCells.indexOf(th as HTMLTableCellElement);
      if (columnIndex < 0) return;
      const key = getTableSortKey(table);
      const current = tableSortStateRef.current.get(key);
      const nextDirection: TableSortDirection =
        current && current.columnIndex === columnIndex && current.direction === "asc" ? "desc" : "asc";
      tableSortStateRef.current.set(key, { columnIndex, direction: nextDirection });
      sortTableDom(table, columnIndex, nextDirection);
    };

    root.addEventListener("click", clickHandler);
    return () => {
      root.removeEventListener("click", clickHandler);
    };
  }, [getTableSortKey]);
};
