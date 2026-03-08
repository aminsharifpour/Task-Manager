import type { MutableRefObject } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TableSortDirection } from "@/hooks/use-dom-table-sort";
import type { VirtualWindow } from "@/hooks/use-virtual-rows";

type AuditSortKey = "createdAt" | "entityType" | "action" | "summary" | "actor" | "entityId";

type AuditLog = {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actor: {
    userId: string;
    fullName: string;
    role: "admin" | "manager" | "member";
  };
};

type Props = {
  auditQuery: string;
  auditEntityFilter: string;
  auditBusy: boolean;
  auditSort: { key: AuditSortKey; direction: TableSortDirection };
  sortedAuditLogs: AuditLog[];
  visibleSortedAuditLogs: AuditLog[];
  auditVirtualWindow: VirtualWindow;
  auditScrollRef: MutableRefObject<HTMLDivElement | null>;
  onAuditQueryChange: (value: string) => void;
  onAuditEntityFilterChange: (value: string) => void;
  onRefresh: () => void;
  onScroll: () => void;
  onToggleSort: (key: AuditSortKey) => void;
  isoDateTimeToJalali: (value: string) => string;
  roleLabel: (role: "admin" | "manager" | "member" | undefined) => string;
};

export default function AuditTrailView({
  auditQuery,
  auditEntityFilter,
  auditBusy,
  auditSort,
  sortedAuditLogs,
  visibleSortedAuditLogs,
  auditVirtualWindow,
  auditScrollRef,
  onAuditQueryChange,
  onAuditEntityFilterChange,
  onRefresh,
  onScroll,
  onToggleSort,
  isoDateTimeToJalali,
  roleLabel,
}: Props) {
  return (
    <Card className="liquid-glass lift-on-hover">
      <CardHeader className="space-y-3">
        <CardTitle>Audit Trail</CardTitle>
        <CardDescription>ثبت تغییرات مهم: چه کسی، چه زمانی، چه چیزی را تغییر داده است</CardDescription>
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            placeholder="جستجو (عملیات/کاربر/خلاصه)"
            value={auditQuery}
            onChange={(e) => onAuditQueryChange(e.target.value)}
          />
          <Select value={auditEntityFilter} onValueChange={onAuditEntityFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="نوع موجودیت" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              <SelectItem value="task">Task</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="team-member">Team Member</SelectItem>
              <SelectItem value="minute">Minute</SelectItem>
              <SelectItem value="settings">Settings</SelectItem>
              <SelectItem value="chat-conversation">Chat Conversation</SelectItem>
              <SelectItem value="chat-message">Chat Message</SelectItem>
              <SelectItem value="accounting-account">Accounting Account</SelectItem>
              <SelectItem value="accounting-transaction">Accounting Transaction</SelectItem>
              <SelectItem value="accounting-budget">Accounting Budget</SelectItem>
              <SelectItem value="backup">Backup</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={onRefresh} disabled={auditBusy}>
            {auditBusy ? "در حال بارگذاری..." : "بروزرسانی"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sortedAuditLogs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            لاگ فعالیتی برای نمایش وجود ندارد.
          </div>
        ) : (
          <div ref={auditScrollRef} onScroll={onScroll} className="max-h-[65vh] overflow-auto rounded-xl border">
            <table className="min-w-full text-sm" data-disable-dom-sort="true">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => onToggleSort("createdAt")}>
                      زمان {auditSort.key === "createdAt" ? (auditSort.direction === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => onToggleSort("entityType")}>
                      موجودیت {auditSort.key === "entityType" ? (auditSort.direction === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => onToggleSort("action")}>
                      عملیات {auditSort.key === "action" ? (auditSort.direction === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => onToggleSort("summary")}>
                      خلاصه {auditSort.key === "summary" ? (auditSort.direction === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => onToggleSort("actor")}>
                      کاربر {auditSort.key === "actor" ? (auditSort.direction === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => onToggleSort("entityId")}>
                      شناسه {auditSort.key === "entityId" ? (auditSort.direction === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditVirtualWindow.paddingTop > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={6} style={{ height: auditVirtualWindow.paddingTop }} />
                  </tr>
                )}
                {visibleSortedAuditLogs.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 text-xs text-muted-foreground">{isoDateTimeToJalali(row.createdAt)}</td>
                    <td className="px-3 py-2">{row.entityType || "-"}</td>
                    <td className="px-3 py-2">{row.action || "-"}</td>
                    <td className="max-w-[340px] truncate px-3 py-2 font-medium">{row.summary || "-"}</td>
                    <td className="px-3 py-2">
                      {row.actor?.fullName || "-"} ({roleLabel(row.actor?.role)})
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{row.entityId || "-"}</td>
                  </tr>
                ))}
                {auditVirtualWindow.paddingBottom > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={6} style={{ height: auditVirtualWindow.paddingBottom }} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
