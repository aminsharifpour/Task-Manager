import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TeamMemberProfileDialogProps = {
  memberProfileOpen: boolean;
  setMemberProfileOpen: (open: boolean) => void;
  selectedMember: any;
  selectedMemberOverview: any;
  toFaNum: (v: string) => string;
  memberInitials: (fullName: string) => string;
  roleLabel: (role: any) => string;
  selectedMemberHrProfile: any;
  isoToJalali: (date: string) => string;
  HR_CONTRACT_ITEMS: Array<{ value: string; label: string }>;
  formatMoney: (value: number) => string;
  selectedMemberAttendanceRecords: any[];
  HR_ATTENDANCE_STATUS_ITEMS: Array<{ value: string; label: string }>;
  selectedMemberLeaveRequests: any[];
  HR_LEAVE_TYPE_ITEMS: Array<{ value: string; label: string }>;
  HR_LEAVE_STATUS_ITEMS: Array<{ value: string; label: string }>;
  selectedMemberTaskRows: any[];
  TASK_STATUS_ITEMS: Array<{ value: string; label: string }>;
  normalizeTaskStatus: (status: any, done: boolean) => string;
  openEditMember: (member: any) => void;
};

export default function TeamMemberProfileDialog({
  memberProfileOpen,
  setMemberProfileOpen,
  selectedMember,
  selectedMemberOverview,
  toFaNum,
  memberInitials,
  roleLabel,
  selectedMemberHrProfile,
  isoToJalali,
  HR_CONTRACT_ITEMS,
  formatMoney,
  selectedMemberAttendanceRecords,
  HR_ATTENDANCE_STATUS_ITEMS,
  selectedMemberLeaveRequests,
  HR_LEAVE_TYPE_ITEMS,
  HR_LEAVE_STATUS_ITEMS,
  selectedMemberTaskRows,
  TASK_STATUS_ITEMS,
  normalizeTaskStatus,
  openEditMember,
}: TeamMemberProfileDialogProps) {
  return (
    <Dialog open={memberProfileOpen} onOpenChange={setMemberProfileOpen}>
      <DialogContent aria-describedby={undefined} className="liquid-glass max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>پروفایل کامل پرسنل</DialogTitle>
          <DialogDescription>نمایش یکجای اطلاعات فردی، پرونده HR، مرخصی، رفت‌وآمد و تسک‌ها</DialogDescription>
        </DialogHeader>
        {!selectedMember ? (
          <p className="text-sm text-muted-foreground">عضوی برای نمایش انتخاب نشده است.</p>
        ) : (
          <div className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">کل ساعت کار ثبت‌شده</p>
                <p className="mt-1 text-xl font-bold">{toFaNum(String(selectedMemberOverview.workHours))}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">مرخصی تایید/در انتظار</p>
                <p className="mt-1 text-xl font-bold">
                  {toFaNum(String(selectedMemberOverview.leaveApproved))} / {toFaNum(String(selectedMemberOverview.leavePending))}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">تسک انجام/کل</p>
                <p className="mt-1 text-xl font-bold">
                  {toFaNum(String(selectedMemberOverview.taskDone))} / {toFaNum(String(selectedMemberOverview.taskTotal))}
                </p>
              </div>
            </section>

            <div className="flex justify-center">
              {selectedMember.avatarDataUrl ? (
                <img src={selectedMember.avatarDataUrl} alt={selectedMember.fullName} className="h-24 w-24 rounded-full border object-cover" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full border bg-muted text-xl font-bold">
                  {memberInitials(selectedMember.fullName)}
                </div>
              )}
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">نام</p>
              <p className="font-semibold">{selectedMember.fullName}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">سمت</p>
              <p>{selectedMember.role || "ثبت نشده"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">نقش دسترسی</p>
              <p>{roleLabel(selectedMember.appRole)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">وضعیت</p>
              <p>{selectedMember.isActive === false ? "غیرفعال" : "فعال"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">ایمیل</p>
              <p>{selectedMember.email || "ثبت نشده"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">تلفن</p>
              <p>{selectedMember.phone || "ثبت نشده"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">بیو</p>
              <p className="text-sm">{selectedMember.bio || "ثبت نشده"}</p>
            </div>

            <section className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-semibold">اطلاعات پرونده منابع انسانی</p>
              {!selectedMemberHrProfile ? (
                <p className="text-xs text-muted-foreground">برای این فرد هنوز پرونده HR ثبت نشده است.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <p className="text-xs"><span className="text-muted-foreground">کد پرسنلی:</span> {selectedMemberHrProfile.employeeCode || "—"}</p>
                  <p className="text-xs"><span className="text-muted-foreground">واحد:</span> {selectedMemberHrProfile.department || "—"}</p>
                  <p className="text-xs"><span className="text-muted-foreground">تاریخ استخدام:</span> {selectedMemberHrProfile.hireDate ? isoToJalali(selectedMemberHrProfile.hireDate) : "—"}</p>
                  <p className="text-xs"><span className="text-muted-foreground">تاریخ تولد:</span> {selectedMemberHrProfile.birthDate ? isoToJalali(selectedMemberHrProfile.birthDate) : "—"}</p>
                  <p className="text-xs"><span className="text-muted-foreground">نوع قرارداد:</span> {HR_CONTRACT_ITEMS.find((x) => x.value === selectedMemberHrProfile.contractType)?.label ?? "—"}</p>
                  <p className="text-xs"><span className="text-muted-foreground">حقوق پایه:</span> {selectedMemberHrProfile.salaryBase ? formatMoney(selectedMemberHrProfile.salaryBase) : "—"}</p>
                  <p className="text-xs"><span className="text-muted-foreground">تحصیلات:</span> {selectedMemberHrProfile.education || "—"}</p>
                  <p className="text-xs"><span className="text-muted-foreground">مهارت‌ها:</span> {selectedMemberHrProfile.skills || "—"}</p>
                  <p className="text-xs"><span className="text-muted-foreground">تماس اضطراری:</span> {selectedMemberHrProfile.emergencyContactName || "—"}</p>
                  <p className="text-xs"><span className="text-muted-foreground">شماره اضطراری:</span> {selectedMemberHrProfile.emergencyContactPhone || "—"}</p>
                  <p className="text-xs sm:col-span-2"><span className="text-muted-foreground">یادداشت:</span> {selectedMemberHrProfile.notes || "—"}</p>
                </div>
              )}
            </section>

            <section className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-semibold">سوابق رفت‌وآمد</p>
              {selectedMemberAttendanceRecords.length === 0 ? (
                <p className="text-xs text-muted-foreground">رکوردی ثبت نشده است.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-muted/30 text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 text-right font-medium">تاریخ</th>
                        <th className="px-2 py-2 text-right font-medium">وضعیت</th>
                        <th className="px-2 py-2 text-right font-medium">ورود</th>
                        <th className="px-2 py-2 text-right font-medium">خروج</th>
                        <th className="px-2 py-2 text-right font-medium">ساعت کار</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMemberAttendanceRecords.slice(0, 20).map((row) => (
                        <tr key={`profile-att-${row.id}`} className="border-t">
                          <td className="px-2 py-2">{isoToJalali(row.date)}</td>
                          <td className="px-2 py-2">{HR_ATTENDANCE_STATUS_ITEMS.find((x) => x.value === row.status)?.label ?? row.status}</td>
                          <td className="px-2 py-2">{row.checkIn ? toFaNum(row.checkIn) : "—"}</td>
                          <td className="px-2 py-2">{row.checkOut ? toFaNum(row.checkOut) : "—"}</td>
                          <td className="px-2 py-2">{toFaNum(String(row.workHours || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-semibold">سوابق مرخصی</p>
              {selectedMemberLeaveRequests.length === 0 ? (
                <p className="text-xs text-muted-foreground">درخواستی ثبت نشده است.</p>
              ) : (
                <div className="space-y-2">
                  {selectedMemberLeaveRequests.slice(0, 20).map((row) => (
                    <div key={`profile-leave-${row.id}`} className="rounded-md border p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{HR_LEAVE_TYPE_ITEMS.find((x) => x.value === row.leaveType)?.label ?? row.leaveType}</p>
                        <Badge variant="outline">{HR_LEAVE_STATUS_ITEMS.find((x) => x.value === row.status)?.label ?? row.status}</Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {isoToJalali(row.fromDate)} تا {isoToJalali(row.toDate)} | {toFaNum(String(row.hours || 0))} ساعت
                      </p>
                      <p className="mt-1">{row.reason || "—"}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-semibold">تسک‌های مرتبط</p>
              {selectedMemberTaskRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">تسکی برای این پرسنل ثبت نشده است.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-muted/30 text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 text-right font-medium">عنوان</th>
                        <th className="px-2 py-2 text-right font-medium">پروژه</th>
                        <th className="px-2 py-2 text-right font-medium">ددلاین</th>
                        <th className="px-2 py-2 text-right font-medium">وضعیت</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMemberTaskRows.slice(0, 20).map((task) => (
                        <tr key={`profile-task-${task.id}`} className="border-t">
                          <td className="px-2 py-2">{task.title || "بدون عنوان"}</td>
                          <td className="px-2 py-2">{task.projectName || "—"}</td>
                          <td className="px-2 py-2">{isoToJalali(task.executionDate)}</td>
                          <td className="px-2 py-2">{TASK_STATUS_ITEMS.find((x) => x.value === normalizeTaskStatus(task.status, Boolean(task.done)))?.label ?? "To Do"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => setMemberProfileOpen(false)}>
            بستن
          </Button>
          {selectedMember && (
            <Button
              onClick={() => {
                setMemberProfileOpen(false);
                openEditMember(selectedMember);
              }}
            >
              ویرایش عضو
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
