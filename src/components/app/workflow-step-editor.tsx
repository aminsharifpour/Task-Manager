import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, GitBranch, GripVertical, Plus, Route, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type WorkflowStepEditorRow = {
  id: string;
  title: string;
  assigneeType:
    | "task_assigner"
    | "task_assignee_primary"
    | "task_assignee_secondary"
    | "project_owner"
    | "project_members"
    | "role"
    | "member"
    | "all_participants";
  assigneeRole?: "admin" | "manager" | "member" | "";
  assigneeMemberId?: string;
  requiresApproval?: boolean;
  approvalAssigneeType?:
    | "task_assigner"
    | "task_assignee_primary"
    | "task_assignee_secondary"
    | "project_owner"
    | "project_members"
    | "role"
    | "member"
    | "all_participants";
  approvalAssigneeRole?: "admin" | "manager" | "member" | "";
  approvalAssigneeMemberId?: string;
  onApprove?: string;
  onReject?: string;
  canvasX?: number;
  canvasY?: number;
};

const ASSIGNEE_TYPE_ITEMS: Array<{ value: WorkflowStepEditorRow["assigneeType"]; label: string }> = [
  { value: "task_assignee_primary", label: "انجام‌دهنده اصلی تسک" },
  { value: "task_assignee_secondary", label: "انجام‌دهنده دوم تسک" },
  { value: "task_assigner", label: "ابلاغ‌کننده تسک" },
  { value: "project_owner", label: "مالک پروژه" },
  { value: "project_members", label: "همه اعضای پروژه" },
  { value: "all_participants", label: "همه مشارکت‌کنندگان تسک" },
  { value: "role", label: "براساس سمت" },
  { value: "member", label: "عضو مشخص" },
];

const ROUTE_ITEMS = [
  { value: "next", label: "مرحله بعد" },
  { value: "previous", label: "مرحله قبل" },
  { value: "stay", label: "باقی بماند" },
  { value: "done", label: "اتمام تسک" },
];

const buildStepId = () => `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const createDefaultStep = (index: number): WorkflowStepEditorRow => ({
  id: buildStepId(),
  title: `مرحله ${index + 1}`,
  assigneeType: "task_assignee_primary",
  assigneeRole: "",
  assigneeMemberId: "",
  requiresApproval: false,
  approvalAssigneeType: "task_assigner",
  approvalAssigneeRole: "",
  approvalAssigneeMemberId: "",
  onApprove: "next",
  onReject: "stay",
  canvasX: 32 + (index % 3) * 280,
  canvasY: 28 + Math.floor(index / 3) * 140,
});

const assigneeLabel = (row: WorkflowStepEditorRow, members: Array<{ id: string; fullName: string }>) => {
  switch (row.assigneeType) {
    case "task_assigner":
      return "ابلاغ‌کننده تسک";
    case "task_assignee_primary":
      return "انجام‌دهنده اصلی";
    case "task_assignee_secondary":
      return "انجام‌دهنده دوم";
    case "project_owner":
      return "مالک پروژه";
    case "project_members":
      return "اعضای پروژه";
    case "all_participants":
      return "همه مشارکت‌کنندگان";
    case "role":
      return row.assigneeRole ? `سمت: ${row.assigneeRole}` : "سمت: نامشخص";
    case "member": {
      const name = members.find((m) => m.id === row.assigneeMemberId)?.fullName ?? "";
      return name ? `عضو: ${name}` : "عضو: نامشخص";
    }
    default:
      return "انجام‌دهنده اصلی";
  }
};

const routeLabel = (value: string | undefined, stepMap: Map<string, string>) => {
  const route = String(value ?? "").trim();
  if (!route || route === "next") return "مرحله بعد";
  if (route === "previous") return "مرحله قبل";
  if (route === "stay") return "همین مرحله";
  if (route === "done") return "اتمام";
  return `پرش به ${stepMap.get(route) ?? "مرحله دیگر"}`;
};

const approvalAssigneeLabel = (row: WorkflowStepEditorRow, members: Array<{ id: string; fullName: string }>) => {
  const type = row.approvalAssigneeType || "task_assigner";
  if (type === "role") return row.approvalAssigneeRole ? `تاییدکننده: سمت ${row.approvalAssigneeRole}` : "تاییدکننده: سمت نامشخص";
  if (type === "member") {
    const name = members.find((m) => m.id === row.approvalAssigneeMemberId)?.fullName ?? "";
    return name ? `تاییدکننده: ${name}` : "تاییدکننده: عضو نامشخص";
  }
  return `تاییدکننده: ${assigneeLabel({ ...row, assigneeType: type, assigneeRole: row.approvalAssigneeRole, assigneeMemberId: row.approvalAssigneeMemberId }, members)}`;
};

export default function WorkflowStepEditor({
  title,
  rows,
  onChange,
  members,
}: {
  title: string;
  rows: WorkflowStepEditorRow[];
  onChange: (next: WorkflowStepEditorRow[]) => void;
  members: Array<{ id: string; fullName: string }>;
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [canvasDraggingId, setCanvasDraggingId] = useState<string | null>(null);
  const [canvasDragOffset, setCanvasDragOffset] = useState({ x: 0, y: 0 });
  const nodeWidth = 220;
  const nodeHeight = 96;
  const canvasWidth = 1100;
  const canvasHeight = Math.max(420, Math.ceil(safeRows.length / 3) * 140 + 140);
  const updateAt = (index: number, patch: Partial<WorkflowStepEditorRow>) => {
    onChange(
      safeRows.map((row, i) =>
        i === index
          ? {
              ...row,
              ...patch,
            }
          : row,
      ),
    );
  };
  const removeAt = (index: number) => onChange(safeRows.filter((_, i) => i !== index));
  const moveAt = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= safeRows.length) return;
    const next = [...safeRows];
    const [picked] = next.splice(index, 1);
    next.splice(nextIndex, 0, picked);
    onChange(next);
  };
  const moveByDrag = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= safeRows.length || toIndex >= safeRows.length) return;
    const next = [...safeRows];
    const [picked] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, picked);
    onChange(next);
  };
  const clampCanvasX = (value: number) => Math.max(8, Math.min(canvasWidth - nodeWidth - 8, value));
  const clampCanvasY = (value: number) => Math.max(8, Math.min(canvasHeight - nodeHeight - 8, value));
  const nodePosition = (row: WorkflowStepEditorRow, index: number) => ({
    x: clampCanvasX(Number.isFinite(Number(row.canvasX)) ? Number(row.canvasX) : 32 + (index % 3) * 280),
    y: clampCanvasY(Number.isFinite(Number(row.canvasY)) ? Number(row.canvasY) : 28 + Math.floor(index / 3) * 140),
  });
  const nodeCenters = useMemo(
    () =>
      safeRows.map((row, idx) => {
        const pos = nodePosition(row, idx);
        return { id: row.id, index: idx, cx: pos.x + nodeWidth / 2, cy: pos.y + nodeHeight / 2 };
      }),
    [safeRows],
  );
  const lineForRoute = (fromIndex: number, route: string | undefined) => {
    const from = nodeCenters[fromIndex];
    if (!from) return null;
    const safeRoute = String(route ?? "").trim();
    let toIndex = fromIndex + 1;
    if (safeRoute === "previous") toIndex = Math.max(0, fromIndex - 1);
    else if (safeRoute === "stay") toIndex = fromIndex;
    else if (safeRoute === "done") return null;
    else if (safeRoute && safeRoute !== "next") {
      const explicit = safeRows.findIndex((step) => String(step.id) === safeRoute);
      if (explicit >= 0) toIndex = explicit;
    }
    const to = nodeCenters[toIndex];
    if (!to) return null;
    return { x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy };
  };
  const beginCanvasDrag = (event: React.MouseEvent, index: number) => {
    event.preventDefault();
    const row = safeRows[index];
    if (!row?.id || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const pos = nodePosition(row, index);
    setCanvasDraggingId(row.id);
    setCanvasDragOffset({
      x: event.clientX - rect.left - pos.x,
      y: event.clientY - rect.top - pos.y,
    });
  };
  const moveCanvasDrag = (event: React.MouseEvent) => {
    if (!canvasDraggingId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nextX = clampCanvasX(event.clientX - rect.left - canvasDragOffset.x);
    const nextY = clampCanvasY(event.clientY - rect.top - canvasDragOffset.y);
    onChange(
      safeRows.map((row) =>
        row.id === canvasDraggingId
          ? {
              ...row,
              canvasX: nextX,
              canvasY: nextY,
            }
          : row,
      ),
    );
  };
  const endCanvasDrag = () => {
    setCanvasDraggingId(null);
  };

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{title}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          onClick={() => onChange([...safeRows, createDefaultStep(safeRows.length)])}
          disabled={safeRows.length >= 12}
        >
          <Plus className="h-3.5 w-3.5" />
          افزودن مرحله
        </Button>
      </div>
      {safeRows.length > 0 && (
        <div className="rounded-lg border bg-muted/20 p-2">
          <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5" />
            بوم بصری جریان (Drag & Drop)
          </div>
          <div className="max-h-[380px] overflow-auto rounded-md border bg-background/60 p-2">
            <div
              ref={canvasRef}
              className="relative select-none rounded-md border border-dashed bg-[linear-gradient(hsl(var(--foreground)/0.04)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground)/0.04)_1px,transparent_1px)] bg-[length:24px_24px]"
              style={{ width: canvasWidth, height: canvasHeight }}
              onMouseMove={moveCanvasDrag}
              onMouseLeave={endCanvasDrag}
              onMouseUp={endCanvasDrag}
            >
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {safeRows.map((row, index) => {
                  const defaultLine = lineForRoute(index, "next");
                  const approveLine = row.requiresApproval ? lineForRoute(index, row.onApprove) : null;
                  const rejectLine = row.requiresApproval ? lineForRoute(index, row.onReject) : null;
                  return (
                    <g key={`line-${row.id || index}`}>
                      {!row.requiresApproval && defaultLine && (
                        <line x1={defaultLine.x1} y1={defaultLine.y1} x2={defaultLine.x2} y2={defaultLine.y2} stroke="hsl(var(--muted-foreground))" strokeWidth="1.8" />
                      )}
                      {approveLine && <line x1={approveLine.x1} y1={approveLine.y1} x2={approveLine.x2} y2={approveLine.y2} stroke="hsl(142 71% 45%)" strokeWidth="2" />}
                      {rejectLine && <line x1={rejectLine.x1} y1={rejectLine.y1} x2={rejectLine.x2} y2={rejectLine.y2} stroke="hsl(0 84% 60%)" strokeWidth="2" strokeDasharray="5 4" />}
                    </g>
                  );
                })}
              </svg>
              {safeRows.map((row, index) => {
                const stepMap = new Map(safeRows.map((step, idx) => [step.id, `مرحله ${idx + 1}`]));
                const pos = nodePosition(row, index);
                return (
                  <div
                    key={`flow-node-${row.id || index}`}
                    className={`absolute w-[220px] cursor-move rounded-md border bg-card p-2 shadow-sm ${canvasDraggingId === row.id ? "ring-2 ring-primary/40" : ""}`}
                    style={{ left: pos.x, top: pos.y }}
                    onMouseDown={(event) => beginCanvasDrag(event, index)}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{`مرحله ${index + 1}`}</Badge>
                      <span className="line-clamp-1 text-xs font-semibold">{row.title || "بدون عنوان"}</span>
                    </div>
                    <div className="line-clamp-1 text-[11px] text-muted-foreground">{assigneeLabel(row, members)}</div>
                    {row.requiresApproval ? (
                      <div className="mt-1.5 space-y-0.5 text-[11px]">
                        <div className="line-clamp-1 text-muted-foreground">{approvalAssigneeLabel(row, members)}</div>
                        <div className="line-clamp-1 text-emerald-700 dark:text-emerald-400">تایید: {routeLabel(row.onApprove, stepMap)}</div>
                        <div className="line-clamp-1 text-rose-700 dark:text-rose-400">رد: {routeLabel(row.onReject, stepMap)}</div>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Route className="h-3 w-3" />
                        مرحله بعد
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {safeRows.length === 0 ? (
        <p className="rounded-md border border-dashed px-2 py-2 text-xs text-muted-foreground">هنوز مرحله‌ای تعریف نشده است.</p>
      ) : (
        <div className="max-h-[52vh] space-y-2 overflow-y-auto pe-1">
          {safeRows.map((row, index) => {
            const stepRouteItems = [
              ...ROUTE_ITEMS,
              ...safeRows
                .filter((_, idx) => idx !== index)
                .map((step, idx) => ({ value: step.id, label: `پرش به: ${step.title || `مرحله ${idx + 1}`}` })),
            ];
            const approveValue = row.onApprove && stepRouteItems.some((item) => item.value === row.onApprove) ? row.onApprove : "next";
            const rejectValue = row.onReject && stepRouteItems.some((item) => item.value === row.onReject) ? row.onReject : "stay";
            return (
              <div
                key={row.id || `workflow-step-${index}`}
                draggable
                onDragStart={() => {
                  setDraggingIndex(index);
                  setDragOverIndex(index);
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOverIndex(index);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverIndex(index);
                }}
                onDragEnd={() => {
                  setDraggingIndex(null);
                  setDragOverIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggingIndex !== null) moveByDrag(draggingIndex, index);
                  setDraggingIndex(null);
                  setDragOverIndex(null);
                }}
                className={`space-y-2 rounded-md border bg-background/40 p-2 transition-colors ${
                  dragOverIndex === index && draggingIndex !== null ? "border-primary/50 bg-primary/5" : ""
                } ${draggingIndex === index ? "opacity-75" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1 text-xs font-medium">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    مرحله {index + 1}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveAt(index, -1)} disabled={index === 0}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveAt(index, 1)} disabled={index >= safeRows.length - 1}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeAt(index)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <Input value={row.title ?? ""} placeholder="عنوان مرحله" onChange={(e) => updateAt(index, { title: e.target.value.slice(0, 120) })} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select value={row.assigneeType || "task_assignee_primary"} onValueChange={(value) => updateAt(index, { assigneeType: value as WorkflowStepEditorRow["assigneeType"] })}>
                    <SelectTrigger>
                      <SelectValue placeholder="ارجاع مرحله" />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNEE_TYPE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {row.assigneeType === "role" && (
                    <Select value={row.assigneeRole || "none"} onValueChange={(value) => updateAt(index, { assigneeRole: value === "none" ? "" : (value as "admin" | "manager" | "member") })}>
                      <SelectTrigger>
                        <SelectValue placeholder="سمت" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">انتخاب نشده</SelectItem>
                        <SelectItem value="admin">ادمین</SelectItem>
                        <SelectItem value="manager">مدیر</SelectItem>
                        <SelectItem value="member">عضو</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {row.assigneeType === "member" && (
                    <Select value={row.assigneeMemberId || "none"} onValueChange={(value) => updateAt(index, { assigneeMemberId: value === "none" ? "" : value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="عضو مشخص" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">انتخاب نشده</SelectItem>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={row.requiresApproval === true}
                    onCheckedChange={(checked) =>
                      updateAt(index, {
                        requiresApproval: checked === true,
                        approvalAssigneeType: checked === true ? (row.approvalAssigneeType || "task_assigner") : row.approvalAssigneeType,
                        approvalAssigneeRole: checked === true ? (row.approvalAssigneeRole || "") : row.approvalAssigneeRole,
                        approvalAssigneeMemberId: checked === true ? (row.approvalAssigneeMemberId || "") : row.approvalAssigneeMemberId,
                      })
                    }
                  />
                  این مرحله نیاز به تایید داشته باشد
                </label>
                {row.requiresApproval === true && (
                  <div className="space-y-2 rounded-md border bg-muted/20 p-2">
                    <p className="text-[11px] text-muted-foreground">تاییدکننده این مرحله</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Select
                        value={row.approvalAssigneeType || "task_assigner"}
                        onValueChange={(value) =>
                          updateAt(index, {
                            approvalAssigneeType: value as WorkflowStepEditorRow["approvalAssigneeType"],
                            approvalAssigneeRole: value === "role" ? row.approvalAssigneeRole || "" : "",
                            approvalAssigneeMemberId: value === "member" ? row.approvalAssigneeMemberId || "" : "",
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="انتخاب تاییدکننده" />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNEE_TYPE_ITEMS.map((item) => (
                            <SelectItem key={`approval-${item.value}`} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(row.approvalAssigneeType || "task_assigner") === "role" && (
                        <Select
                          value={row.approvalAssigneeRole || "none"}
                          onValueChange={(value) => updateAt(index, { approvalAssigneeRole: value === "none" ? "" : (value as "admin" | "manager" | "member") })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="سمت تاییدکننده" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">انتخاب نشده</SelectItem>
                            <SelectItem value="admin">ادمین</SelectItem>
                            <SelectItem value="manager">مدیر</SelectItem>
                            <SelectItem value="member">عضو</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {(row.approvalAssigneeType || "task_assigner") === "member" && (
                        <Select
                          value={row.approvalAssigneeMemberId || "none"}
                          onValueChange={(value) => updateAt(index, { approvalAssigneeMemberId: value === "none" ? "" : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="عضو تاییدکننده" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">انتخاب نشده</SelectItem>
                            {members.map((member) => (
                              <SelectItem key={`approval-member-${member.id}`} value={member.id}>
                                {member.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">مسیر فرایند بعد از تایید یا رد</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Select value={approveValue} onValueChange={(value) => updateAt(index, { onApprove: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="در صورت تایید" />
                        </SelectTrigger>
                        <SelectContent>
                          {stepRouteItems.map((item) => (
                            <SelectItem key={`approve-${row.id}-${item.value}`} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={rejectValue} onValueChange={(value) => updateAt(index, { onReject: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="در صورت رد" />
                        </SelectTrigger>
                        <SelectContent>
                          {stepRouteItems.map((item) => (
                            <SelectItem key={`reject-${row.id}-${item.value}`} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
