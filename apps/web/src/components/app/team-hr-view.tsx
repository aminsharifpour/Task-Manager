import { memo, useEffect, useMemo, useState, type Dispatch, type JSX, type MouseEvent, type RefObject, type SetStateAction, type UIEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BufferedInput, BufferedTextarea } from "@/components/ui/buffered-fields";
import type { AppContextMenuItem } from "@/components/ui/app-context-menu";
import TeamHrOverviewCards from "@/components/app/team-hr-overview-cards";
import TeamHrReportCard from "@/components/app/team-hr-report-card";
import TeamMemberEditDialog from "@/components/app/team-member-edit-dialog";
import TeamMemberAccessDialog from "@/components/app/team-member-access-dialog";
import TeamMemberProfileDialog from "@/components/app/team-member-profile-dialog";
import TeamMembersCard from "@/components/app/team-members-card";
import { TablePagination } from "@/components/ui/table-pagination";

type AppRole = "admin" | "manager" | "member";
type LeaveStatus = "pending" | "approved" | "rejected" | string;
type AttendanceStatus = string;
type AttendanceBadgeStatus = "present" | "remote" | "leave" | "absent";

type OptionItem = {
  value: string;
  label: string;
};

type TeamRow = {
  id: string;
  name: string;
  description?: string;
};

type TeamMemberRow = {
  id: string;
  fullName: string;
  role?: string;
  teamIds?: string[];
  appRole?: AppRole;
  isActive?: boolean;
  email?: string;
  phone?: string;
  bio?: string;
  avatarDataUrl?: string;
};

type MemberFormDraft = {
  fullName: string;
  role: string;
  email: string;
  phone: string;
  bio: string;
  avatarDataUrl: string;
  appRole: AppRole;
  isActive: boolean;
  teamIds: string[];
  moduleAccess: Record<string, boolean>;
  permissionOverrides: Record<string, boolean>;
  policyOverrides: Record<string, Record<string, string>>;
  password: string;
};

type HrSummary = {
  profileCoveragePercent?: number;
  pendingLeaves?: number;
  avgWorkHours?: number;
};

type HrProfileDraft = {
  employeeCode: string;
  department: string;
  managerId: string;
  hireDate: string;
  birthDate: string;
  nationalId: string;
  contractType: string;
  salaryBase: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  education: string;
  skills: string;
  notes: string;
};

type HrLeaveDraft = {
  memberId: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  hours: string;
  reason: string;
};

type HrLeaveRow = {
  id: string;
  memberId: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  hours?: number | string;
  reason: string;
  status: LeaveStatus;
};

type HrAttendanceSummary = {
  total: number;
  attendanceRate: number;
  totalHours: number;
  avgHours: number;
  absent: number;
};

type HrAttendanceDraft = {
  memberId: string;
  date: string;
  status: AttendanceStatus;
  checkIn: string;
  checkOut: string;
  workHours: string;
  note: string;
};

type HrAttendanceRow = {
  id: string;
  memberId: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  workHours?: number;
  note?: string;
};

type HrReportTotals = {
  avgProductivity: number;
  totalWorkHours: number;
  totalApprovedLeaveDays: number;
  totalPendingLeaves: number;
};

type HrMemberReportRow = {
  member: TeamMemberRow;
  workHours: number;
  attendanceRate: number;
  approvedLeaveDays: number;
  approvedLeaveHours: number;
  pendingLeaves: number;
  taskDone: number;
  taskTotal: number;
  taskOverdue: number;
  taskBlocked: number;
  productivityScore: number;
  productivityLabel: string;
};

type MemberOverview = {
  workHours: number;
  leaveApproved: number;
  leavePending: number;
  taskDone: number;
  taskTotal: number;
};

type HrProfileRecord = {
  employeeCode?: string;
  department?: string;
  hireDate?: string;
  birthDate?: string;
  contractType?: string;
  salaryBase?: string | number;
  education?: string;
  skills?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
};

type AttendanceRecord = {
  id: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  workHours?: number;
  note?: string;
};

type TaskRow = {
  id: string;
  title?: string;
  status?: string;
  done?: boolean;
};

type VirtualWindowState = {
  paddingTop: number;
  paddingBottom: number;
};

type VirtualListHandle = {
  ref: RefObject<HTMLDivElement | null>;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  windowState: VirtualWindowState;
};

type DatePickerFieldProps = {
  label: string;
  valueIso: string;
  onChange: (value: string) => void;
};

type TeamHrViewProps = {
  shellSidebarCollapsed?: boolean;
  memberOpen: boolean;
  setMemberOpen: (open: boolean) => void;
  memberDraft: MemberFormDraft;
  setMemberDraft: Dispatch<SetStateAction<MemberFormDraft>>;
  memberErrors: Record<string, string>;
  memberInitials: (fullName: string) => string;
  pickAvatarForDraft: (file: File | undefined, mode: "add" | "edit") => Promise<void>;
  addMember: () => void;
  teams: TeamRow[];
  teamDraft: {
    name: string;
    description: string;
  };
  setTeamDraft: Dispatch<SetStateAction<{ name: string; description: string }>>;
  addTeamGroup: () => void;
  removeTeamGroup: (id: string) => Promise<void>;
  memberSearch: string;
  setMemberSearch: (value: string) => void;
  teamMembers: TeamMemberRow[];
  filteredTeamMembers: TeamMemberRow[];
  teamMembersVirtual: VirtualListHandle;
  selectedMemberId: string | null;
  setSelectedMemberId: (id: string) => void;
  setMemberProfileOpen: (open: boolean) => void;
  openContextMenu: (event: MouseEvent, title: string, items: AppContextMenuItem[]) => void;
  openEditMember: (member: TeamMemberRow, step?: "basic" | "profile" | "advanced") => void;
  openAccessEditor: (member: TeamMemberRow) => void;
  copyTextToClipboard: (text: string, successMessage: string) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  roleLabel: (role: AppRole | undefined) => string;
  toFaNum: (value: string) => string;
  moduleAccessOptions: Array<{ key: string; label: string }>;
  accessPresets: Array<{
    id: string;
    name: string;
    moduleAccess: Record<string, boolean>;
    permissionOverrides: Record<string, boolean>;
    policyOverrides: Record<string, Record<string, string>>;
  }>;
  saveMemberAccessPreset: (payload: {
    name: string;
    moduleAccess: Record<string, boolean>;
    permissionOverrides: Record<string, boolean>;
    policyOverrides: Record<string, Record<string, string>>;
  }) => Promise<void>;
  hrSummary: HrSummary | null;
  selectedMember: TeamMemberRow | null;
  hrProfileDraft: HrProfileDraft;
  setHrProfileDraft: Dispatch<SetStateAction<HrProfileDraft>>;
  hrProfileErrors: Record<string, string>;
  DatePickerField: (props: DatePickerFieldProps) => JSX.Element;
  isHrManager: boolean;
  HR_CONTRACT_ITEMS: OptionItem[];
  normalizeAmountInput: (value: string) => string;
  saveHrProfile: () => void;
  hrLeaveDraft: HrLeaveDraft;
  setHrLeaveDraft: Dispatch<SetStateAction<HrLeaveDraft>>;
  activeTeamMembers: TeamMemberRow[];
  hrLeaveErrors: Record<string, string>;
  HR_LEAVE_TYPE_ITEMS: OptionItem[];
  submitHrLeaveRequest: () => void;
  visibleHrLeaveRequests: HrLeaveRow[];
  teamMemberNameById: Map<string, string>;
  HR_LEAVE_STATUS_ITEMS: OptionItem[];
  isoToJalali: (date: string) => string;
  reviewHrLeave: (id: string, status: "approved" | "rejected") => Promise<void> | void;
  hrAttendanceSummary: HrAttendanceSummary;
  hrAttendanceMonth: string;
  setHrAttendanceMonth: Dispatch<SetStateAction<string>>;
  hrAttendanceDraft: HrAttendanceDraft;
  setHrAttendanceDraft: Dispatch<SetStateAction<HrAttendanceDraft>>;
  hrCheckInInputRef: RefObject<HTMLInputElement | null>;
  hrCheckOutInputRef: RefObject<HTMLInputElement | null>;
  normalizeTimeInput: (value: string) => string;
  commitHrAttendanceTime: (field: "checkIn" | "checkOut", value: string) => void;
  calculateWorkHoursFromTime: (checkIn: string, checkOut: string) => number;
  hrAttendanceErrors: Record<string, string>;
  isHrAdmin: boolean;
  saveHrAttendanceRecord: () => void;
  hrAttendanceVirtual: VirtualListHandle;
  visibleHrAttendanceRecords: HrAttendanceRow[];
  hrAttendanceBadgeClass: (status: AttendanceBadgeStatus) => string;
  HR_ATTENDANCE_STATUS_ITEMS: OptionItem[];
  editHrAttendanceRecord: (row: HrAttendanceRow) => void;
  removeHrAttendanceRecord: (row: HrAttendanceRow) => Promise<void>;
  exportHrReportCsv: () => void;
  hrReportTotals: HrReportTotals;
  hrMemberReportRows: HrMemberReportRow[];
  memberProfileOpen: boolean;
  selectedMemberOverview: MemberOverview;
  selectedMemberHrProfile: HrProfileRecord | null;
  formatMoney: (value: number) => string;
  selectedMemberAttendanceRecords: AttendanceRecord[];
  selectedMemberLeaveRequests: HrLeaveRow[];
  selectedMemberTaskRows: TaskRow[];
  TASK_STATUS_ITEMS: OptionItem[];
  normalizeTaskStatus: (status: string | undefined, done: boolean) => string;
  memberEditOpen: boolean;
  setMemberEditOpen: (open: boolean) => void;
  memberAccessOpen: boolean;
  setMemberAccessOpen: (open: boolean) => void;
  setEditingMemberId: (value: string | null) => void;
  memberEditInitialStep: "basic" | "profile" | "advanced";
  memberEditDraft: MemberFormDraft;
  setMemberEditDraft: Dispatch<SetStateAction<MemberFormDraft>>;
  memberEditErrors: Record<string, string>;
  updateMember: () => void;
  updateMemberAccess: () => void;
};

function TeamHrView({
  memberOpen,
  setMemberOpen,
  memberDraft,
  setMemberDraft,
  memberErrors,
  memberInitials,
  pickAvatarForDraft,
  addMember,
  teams,
  teamDraft,
  setTeamDraft,
  addTeamGroup,
  removeTeamGroup,
  memberSearch,
  setMemberSearch,
  teamMembers,
  filteredTeamMembers,
  teamMembersVirtual,
  selectedMemberId,
  setSelectedMemberId,
  setMemberProfileOpen,
  openContextMenu,
  openEditMember,
  openAccessEditor,
  copyTextToClipboard,
  removeMember,
  roleLabel,
  toFaNum,
  moduleAccessOptions,
  accessPresets,
  saveMemberAccessPreset,
  hrSummary,
  selectedMember,
  hrProfileDraft,
  setHrProfileDraft,
  hrProfileErrors,
  DatePickerField,
  isHrManager,
  HR_CONTRACT_ITEMS,
  normalizeAmountInput,
  saveHrProfile,
  hrLeaveDraft,
  setHrLeaveDraft,
  activeTeamMembers,
  hrLeaveErrors,
  HR_LEAVE_TYPE_ITEMS,
  submitHrLeaveRequest,
  visibleHrLeaveRequests,
  teamMemberNameById,
  HR_LEAVE_STATUS_ITEMS,
  isoToJalali,
  reviewHrLeave,
  hrAttendanceSummary,
  hrAttendanceMonth,
  setHrAttendanceMonth,
  hrAttendanceDraft,
  setHrAttendanceDraft,
  hrCheckInInputRef,
  hrCheckOutInputRef,
  normalizeTimeInput,
  commitHrAttendanceTime,
  calculateWorkHoursFromTime,
  hrAttendanceErrors,
  isHrAdmin,
  saveHrAttendanceRecord,
  hrAttendanceVirtual,
  visibleHrAttendanceRecords,
  hrAttendanceBadgeClass,
  HR_ATTENDANCE_STATUS_ITEMS,
  editHrAttendanceRecord,
  removeHrAttendanceRecord,
  exportHrReportCsv,
  hrReportTotals,
  hrMemberReportRows,
  memberProfileOpen,
  selectedMemberOverview,
  selectedMemberHrProfile,
  formatMoney,
  selectedMemberAttendanceRecords,
  selectedMemberLeaveRequests,
  selectedMemberTaskRows,
  TASK_STATUS_ITEMS,
  normalizeTaskStatus,
  memberEditOpen,
  setMemberEditOpen,
  memberAccessOpen,
  setMemberAccessOpen,
  setEditingMemberId,
  memberEditInitialStep,
  memberEditDraft,
  setMemberEditDraft,
  memberEditErrors,
  updateMember,
  updateMemberAccess,
}: TeamHrViewProps) {
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendancePageSize, setAttendancePageSize] = useState(20);
  const paginatedAttendanceRows = useMemo(() => {
    const start = (attendancePage - 1) * attendancePageSize;
    return visibleHrAttendanceRecords.slice(start, start + attendancePageSize);
  }, [attendancePage, attendancePageSize, visibleHrAttendanceRecords]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(visibleHrAttendanceRecords.length / attendancePageSize));
    if (attendancePage > totalPages) setAttendancePage(totalPages);
  }, [attendancePage, attendancePageSize, visibleHrAttendanceRecords.length]);

  return (
    <>
      <TeamMembersCard
        memberOpen={memberOpen}
        setMemberOpen={setMemberOpen}
        memberDraft={memberDraft}
        setMemberDraft={setMemberDraft}
        memberErrors={memberErrors}
        memberInitials={memberInitials}
        pickAvatarForDraft={pickAvatarForDraft}
        addMember={addMember}
        teams={teams}
        teamDraft={teamDraft}
        setTeamDraft={setTeamDraft}
        addTeamGroup={addTeamGroup}
        removeTeamGroup={removeTeamGroup}
        memberSearch={memberSearch}
        setMemberSearch={setMemberSearch}
        totalTeamMembers={Array.isArray(teamMembers) ? teamMembers.length : 0}
        filteredTeamMembers={filteredTeamMembers}
        teamMembersVirtual={teamMembersVirtual}
        selectedMemberId={selectedMemberId}
        setSelectedMemberId={setSelectedMemberId}
        setMemberProfileOpen={setMemberProfileOpen}
        openContextMenu={openContextMenu}
        openEditMember={openEditMember}
        openAccessEditor={openAccessEditor}
        copyTextToClipboard={copyTextToClipboard}
        removeMember={removeMember}
        roleLabel={roleLabel}
        toFaNum={toFaNum}
        moduleAccessOptions={moduleAccessOptions}
        accessPresets={accessPresets}
        saveMemberAccessPreset={saveMemberAccessPreset}
      />

      <TeamHrOverviewCards toFaNum={toFaNum} hrSummary={hrSummary} />

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="oneui-hr-shell">
          <CardHeader>
            <CardTitle>پرونده پرسنلی</CardTitle>
            <CardDescription>اطلاعات منابع انسانی عضو انتخاب‌شده را ثبت و نگهداری کن.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedMember ? (
              <p className="text-sm text-muted-foreground">ابتدا از جدول اعضای تیم یک عضو انتخاب کن.</p>
            ) : (
              <>
                <div className="oneui-hr-panel rounded-xl border border-border/16 p-3 text-sm">
                  <p className="text-xs text-muted-foreground">عضو انتخاب‌شده</p>
                  <p className="font-semibold">{selectedMember.fullName}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <BufferedInput
                    placeholder="کد پرسنلی"
                    value={hrProfileDraft.employeeCode}
                    onCommit={(next) => setHrProfileDraft((prev) => ({ ...prev, employeeCode: next }))}
                  />
                  <BufferedInput
                    placeholder="واحد سازمانی"
                    value={hrProfileDraft.department}
                    onCommit={(next) => setHrProfileDraft((prev) => ({ ...prev, department: next }))}
                  />
                </div>
                {hrProfileErrors.department && <p className="text-xs text-destructive">{hrProfileErrors.department}</p>}
                <div className="grid gap-3 md:grid-cols-2">
                  <DatePickerField
                    label="تاریخ استخدام"
                    valueIso={hrProfileDraft.hireDate}
                    onChange={(value) => setHrProfileDraft((prev) => ({ ...prev, hireDate: value }))}
                  />
                  <DatePickerField
                    label="تاریخ تولد"
                    valueIso={hrProfileDraft.birthDate}
                    onChange={(value) => setHrProfileDraft((prev) => ({ ...prev, birthDate: value }))}
                  />
                </div>
                {isHrManager && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Select value={hrProfileDraft.contractType} onValueChange={(value) => setHrProfileDraft((prev) => ({ ...prev, contractType: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="نوع قرارداد" />
                      </SelectTrigger>
                      <SelectContent>
                        {HR_CONTRACT_ITEMS.map((row) => (
                          <SelectItem key={row.value} value={row.value}>
                            {row.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <BufferedInput
                      placeholder="حقوق پایه (تومان)"
                      value={hrProfileDraft.salaryBase}
                      normalize={normalizeAmountInput}
                      onCommit={(next) => setHrProfileDraft((prev) => ({ ...prev, salaryBase: next }))}
                    />
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <BufferedInput
                    placeholder="نام تماس اضطراری"
                    value={hrProfileDraft.emergencyContactName}
                    onCommit={(next) => setHrProfileDraft((prev) => ({ ...prev, emergencyContactName: next }))}
                  />
                  <BufferedInput
                    placeholder="شماره تماس اضطراری"
                    value={hrProfileDraft.emergencyContactPhone}
                    onCommit={(next) => setHrProfileDraft((prev) => ({ ...prev, emergencyContactPhone: next }))}
                  />
                </div>
                <BufferedInput
                  placeholder="تحصیلات"
                  value={hrProfileDraft.education}
                  onCommit={(next) => setHrProfileDraft((prev) => ({ ...prev, education: next }))}
                />
                <BufferedTextarea
                  placeholder="مهارت‌ها (با کاما جدا کن)"
                  value={hrProfileDraft.skills}
                  onCommit={(next) => setHrProfileDraft((prev) => ({ ...prev, skills: next }))}
                />
                <BufferedTextarea
                  placeholder="یادداشت منابع انسانی"
                  value={hrProfileDraft.notes}
                  onCommit={(next) => setHrProfileDraft((prev) => ({ ...prev, notes: next }))}
                />
                <div className="flex justify-end">
                  <Button onClick={() => void saveHrProfile()}>ذخیره پرونده</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="oneui-hr-shell">
          <CardHeader>
            <CardTitle>درخواست مرخصی</CardTitle>
            <CardDescription>ثبت، مشاهده و تایید/رد درخواست‌های مرخصی</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isHrManager && (
              <Select value={hrLeaveDraft.memberId} onValueChange={(value) => setHrLeaveDraft((prev) => ({ ...prev, memberId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="عضو" />
                </SelectTrigger>
                <SelectContent>
                  {activeTeamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hrLeaveErrors.memberId && <p className="text-xs text-destructive">{hrLeaveErrors.memberId}</p>}
            <Select value={hrLeaveDraft.leaveType} onValueChange={(value) => setHrLeaveDraft((prev) => ({ ...prev, leaveType: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="نوع مرخصی" />
              </SelectTrigger>
              <SelectContent>
                {HR_LEAVE_TYPE_ITEMS.map((row) => (
                  <SelectItem key={row.value} value={row.value}>
                    {row.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid gap-3 md:grid-cols-2">
              <DatePickerField label="از تاریخ" valueIso={hrLeaveDraft.fromDate} onChange={(value) => setHrLeaveDraft((prev) => ({ ...prev, fromDate: value }))} />
              <DatePickerField label="تا تاریخ" valueIso={hrLeaveDraft.toDate} onChange={(value) => setHrLeaveDraft((prev) => ({ ...prev, toDate: value }))} />
            </div>
            {(hrLeaveErrors.fromDate || hrLeaveErrors.toDate) && <p className="text-xs text-destructive">{hrLeaveErrors.fromDate || hrLeaveErrors.toDate}</p>}
            <BufferedInput
              placeholder="تعداد ساعت (اختیاری)"
              value={hrLeaveDraft.hours}
              normalize={normalizeAmountInput}
              onCommit={(next) => setHrLeaveDraft((prev) => ({ ...prev, hours: next }))}
            />
            <BufferedTextarea
              placeholder="دلیل مرخصی"
              value={hrLeaveDraft.reason}
              onCommit={(next) => setHrLeaveDraft((prev) => ({ ...prev, reason: next }))}
            />
            {hrLeaveErrors.reason && <p className="text-xs text-destructive">{hrLeaveErrors.reason}</p>}
            <div className="flex justify-end">
              <Button onClick={() => void submitHrLeaveRequest()}>ثبت درخواست</Button>
            </div>

            <div className="max-h-[320px] space-y-2 overflow-y-auto pt-2">
              {visibleHrLeaveRequests.length === 0 ? (
                <p className="text-xs text-muted-foreground">درخواستی ثبت نشده است.</p>
              ) : (
                visibleHrLeaveRequests.map((row) => (
                  <div key={row.id} className="oneui-hr-panel rounded-lg border border-border/16 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{teamMemberNameById.get(row.memberId) ?? "نامشخص"}</p>
                      <Badge variant={row.status === "pending" ? "secondary" : row.status === "approved" ? "default" : "destructive"}>
                        {HR_LEAVE_STATUS_ITEMS.find((item) => item.value === row.status)?.label ?? row.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {HR_LEAVE_TYPE_ITEMS.find((item) => item.value === row.leaveType)?.label ?? row.leaveType} | {isoToJalali(row.fromDate)} تا {isoToJalali(row.toDate)}
                    </p>
                    <p className="mt-1">{row.reason}</p>
                    {isHrManager && row.status === "pending" && (
                      <div className="mt-2 flex items-center gap-2">
                        <Button size="sm" onClick={() => void reviewHrLeave(row.id, "approved")}>
                          تایید
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => void reviewHrLeave(row.id, "rejected")}>
                          رد
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="oneui-hr-shell">
        <CardHeader>
          <CardTitle>حضور و غیاب</CardTitle>
          <CardDescription>ثبت رکورد روزانه، محاسبه خودکار ساعت کار و مشاهده وضعیت ماهانه تیم</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="oneui-task-summary-card rounded-lg border border-border/16 p-3">
              <p className="text-xs text-muted-foreground">تعداد رکورد ماه</p>
              <p className="mt-1 text-xl font-bold">{toFaNum(String(hrAttendanceSummary.total))}</p>
            </div>
            <div className="oneui-task-summary-card rounded-lg border border-border/16 p-3">
              <p className="text-xs text-muted-foreground">نرخ حضور ماه</p>
              <p className="mt-1 text-xl font-bold">{toFaNum(String(hrAttendanceSummary.attendanceRate))}%</p>
            </div>
            <div className="oneui-task-summary-card rounded-lg border border-border/16 p-3">
              <p className="text-xs text-muted-foreground">کل ساعت کاری</p>
              <p className="mt-1 text-xl font-bold">{toFaNum(String(hrAttendanceSummary.totalHours))}</p>
            </div>
            <div className="oneui-task-summary-card rounded-lg border border-border/16 p-3">
              <p className="text-xs text-muted-foreground">میانگین ساعت روزانه</p>
              <p className="mt-1 text-xl font-bold">{toFaNum(String(hrAttendanceSummary.avgHours))}</p>
            </div>
            <div className="oneui-task-summary-card rounded-lg border border-border/16 p-3">
              <p className="text-xs text-muted-foreground">غیبت ثبت‌شده</p>
              <p className="mt-1 text-xl font-bold text-destructive">{toFaNum(String(hrAttendanceSummary.absent))}</p>
            </div>
          </section>

          <div className="oneui-hr-panel rounded-xl border border-border/16 p-4">
            <p className="mb-3 text-sm font-semibold">ثبت رکورد حضور جدید</p>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <DatePickerField
                label="ماه گزارش (شمسی)"
                valueIso={`${hrAttendanceMonth}-01`}
                onChange={(value) => {
                  const next = String(value ?? "").slice(0, 7);
                  if (/^\\d{4}-\\d{2}$/.test(next)) {
                    setHrAttendanceMonth(next);
                  }
                }}
              />
              <Select value={hrAttendanceDraft.memberId} onValueChange={(value) => setHrAttendanceDraft((prev) => ({ ...prev, memberId: value }))}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="عضو پرسنل" />
                </SelectTrigger>
                <SelectContent>
                  {activeTeamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DatePickerField
                label="تاریخ رکورد"
                valueIso={hrAttendanceDraft.date}
                onChange={(value) => setHrAttendanceDraft((prev) => ({ ...prev, date: value }))}
              />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-5">
              <Select value={hrAttendanceDraft.status} onValueChange={(value) => setHrAttendanceDraft((prev) => ({ ...prev, status: value }))}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="وضعیت حضور" />
                </SelectTrigger>
                <SelectContent>
                  {HR_ATTENDANCE_STATUS_ITEMS.map((row) => (
                    <SelectItem key={row.value} value={row.value}>
                      {row.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                key={`hr-checkin-${hrAttendanceDraft.memberId}-${hrAttendanceDraft.date}-${hrAttendanceDraft.status}-${hrAttendanceDraft.checkIn}`}
                ref={hrCheckInInputRef}
                className="h-10"
                type="text"
                inputMode="numeric"
                dir="ltr"
                placeholder="HH:mm"
                defaultValue={hrAttendanceDraft.checkIn}
                disabled={hrAttendanceDraft.status === "leave"}
                onInput={(event) => {
                  const node = event.currentTarget;
                  const normalized = normalizeTimeInput(node.value);
                  if (node.value !== normalized) {
                    node.value = normalized;
                  }
                }}
                onBlur={(event) => commitHrAttendanceTime("checkIn", event.currentTarget.value)}
              />
              <Input
                key={`hr-checkout-${hrAttendanceDraft.memberId}-${hrAttendanceDraft.date}-${hrAttendanceDraft.status}-${hrAttendanceDraft.checkOut}`}
                ref={hrCheckOutInputRef}
                className="h-10"
                type="text"
                inputMode="numeric"
                dir="ltr"
                placeholder="HH:mm"
                defaultValue={hrAttendanceDraft.checkOut}
                disabled={hrAttendanceDraft.status === "leave"}
                onInput={(event) => {
                  const node = event.currentTarget;
                  const normalized = normalizeTimeInput(node.value);
                  if (node.value !== normalized) {
                    node.value = normalized;
                  }
                }}
                onBlur={(event) => commitHrAttendanceTime("checkOut", event.currentTarget.value)}
              />
              <div className="flex h-10 items-center rounded-md border bg-emerald-50 px-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                ساعت کار: {toFaNum(String(hrAttendanceDraft.status === "leave" ? 0 : calculateWorkHoursFromTime(hrAttendanceDraft.checkIn, hrAttendanceDraft.checkOut)))} ساعت
              </div>
              <BufferedInput
                className="h-10"
                placeholder="یادداشت کوتاه"
                value={hrAttendanceDraft.note}
                onCommit={(next) => setHrAttendanceDraft((prev) => ({ ...prev, note: next }))}
              />
            </div>
          </div>
          {hrAttendanceErrors.memberId && <p className="text-xs text-destructive">{hrAttendanceErrors.memberId}</p>}
          <div className="flex justify-end">
            <Button disabled={!isHrAdmin} onClick={() => void saveHrAttendanceRecord()}>
              ذخیره رکورد حضور
            </Button>
          </div>

          <>
            <div ref={hrAttendanceVirtual.ref} onScroll={hrAttendanceVirtual.onScroll} className="app-minimal-table-shell max-h-[62vh]">
              <div className="app-minimal-table-scroll max-h-[62vh] overflow-auto">
              <table className="app-minimal-table min-w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-right font-medium">عضو</th>
                    <th className="px-2 py-2 text-right font-medium">تاریخ</th>
                    <th className="px-2 py-2 text-right font-medium">وضعیت</th>
                    <th className="px-2 py-2 text-right font-medium">ورود</th>
                    <th className="px-2 py-2 text-right font-medium">خروج</th>
                    <th className="px-2 py-2 text-right font-medium">ساعت کار</th>
                    <th className="px-2 py-2 text-right font-medium">یادداشت</th>
                    {isHrAdmin && <th className="px-2 py-2 text-right font-medium">عملیات</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibleHrAttendanceRecords.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={isHrAdmin ? 8 : 7}>
                        رکوردی برای این ماه ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {paginatedAttendanceRows.map((row) => (
                        <tr key={row.id}>
                          <td className="px-2 py-2 font-medium">{teamMemberNameById.get(row.memberId) ?? "نامشخص"}</td>
                          <td className="px-2 py-2">{isoToJalali(row.date)}</td>
                          <td className="px-2 py-2">
                            <Badge variant="outline" className={hrAttendanceBadgeClass(row.status as AttendanceBadgeStatus)}>
                              {HR_ATTENDANCE_STATUS_ITEMS.find((item) => item.value === row.status)?.label ?? row.status}
                            </Badge>
                          </td>
                          <td className="px-2 py-2">{row.checkIn ? toFaNum(row.checkIn) : "—"}</td>
                          <td className="px-2 py-2">{row.checkOut ? toFaNum(row.checkOut) : "—"}</td>
                          <td className="px-2 py-2 font-semibold">{toFaNum(String(row.workHours || 0))}</td>
                          <td className="max-w-[260px] truncate px-2 py-2">{row.note || "—"}</td>
                          {isHrAdmin && (
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-1">
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => editHrAttendanceRecord(row)} title="ویرایش رکورد">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => void removeHrAttendanceRecord(row)}
                                  title="حذف رکورد"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
              </div>
            </div>
            {visibleHrAttendanceRecords.length > 0 && (
              <TablePagination
                page={attendancePage}
                pageSize={attendancePageSize}
                totalItems={visibleHrAttendanceRecords.length}
                onPageChange={setAttendancePage}
                onPageSizeChange={(pageSize) => {
                  setAttendancePageSize(pageSize);
                  setAttendancePage(1);
                }}
                toFaNum={toFaNum}
              />
            )}
          </>
        </CardContent>
      </Card>

      <TeamHrReportCard
        exportHrReportCsv={exportHrReportCsv}
        toFaNum={toFaNum}
        hrReportTotals={hrReportTotals}
        hrMemberReportRows={hrMemberReportRows}
        setSelectedMemberId={setSelectedMemberId}
        setMemberProfileOpen={setMemberProfileOpen}
      />

      <TeamMemberProfileDialog
        memberProfileOpen={memberProfileOpen}
        setMemberProfileOpen={setMemberProfileOpen}
        selectedMember={selectedMember}
        selectedMemberOverview={selectedMemberOverview}
        toFaNum={toFaNum}
        memberInitials={memberInitials}
        roleLabel={roleLabel}
        selectedMemberHrProfile={selectedMemberHrProfile}
        isoToJalali={isoToJalali}
        HR_CONTRACT_ITEMS={HR_CONTRACT_ITEMS}
        formatMoney={formatMoney}
        selectedMemberAttendanceRecords={selectedMemberAttendanceRecords}
        HR_ATTENDANCE_STATUS_ITEMS={HR_ATTENDANCE_STATUS_ITEMS}
        selectedMemberLeaveRequests={selectedMemberLeaveRequests}
        HR_LEAVE_TYPE_ITEMS={HR_LEAVE_TYPE_ITEMS}
        HR_LEAVE_STATUS_ITEMS={HR_LEAVE_STATUS_ITEMS}
        selectedMemberTaskRows={selectedMemberTaskRows}
        TASK_STATUS_ITEMS={TASK_STATUS_ITEMS}
        normalizeTaskStatus={normalizeTaskStatus}
        openEditMember={openEditMember}
        openAccessEditor={openAccessEditor}
        moduleAccessOptions={moduleAccessOptions}
      />

      <TeamMemberAccessDialog
        memberAccessOpen={memberAccessOpen}
        setMemberAccessOpen={setMemberAccessOpen}
        selectedMember={selectedMember}
        memberEditDraft={memberEditDraft}
        setMemberEditDraft={setMemberEditDraft}
        memberEditErrors={memberEditErrors}
        moduleAccessOptions={moduleAccessOptions}
        accessPresets={accessPresets}
        saveMemberAccessPreset={saveMemberAccessPreset}
        updateMemberAccess={updateMemberAccess}
      />

      <TeamMemberEditDialog
        memberEditOpen={memberEditOpen}
        initialStep={memberEditInitialStep}
        setMemberEditOpen={setMemberEditOpen}
        setEditingMemberId={setEditingMemberId}
        memberEditDraft={memberEditDraft}
        setMemberEditDraft={setMemberEditDraft}
        memberEditErrors={memberEditErrors}
        memberInitials={memberInitials}
        pickAvatarForDraft={pickAvatarForDraft}
        updateMember={updateMember}
        teams={teams}
        moduleAccessOptions={moduleAccessOptions}
        accessPresets={accessPresets}
        saveMemberAccessPreset={saveMemberAccessPreset}
      />
    </>
  );
}

export default memo(TeamHrView);
