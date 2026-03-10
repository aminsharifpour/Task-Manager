// @ts-nocheck
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BufferedInput, BufferedTextarea } from "@/components/ui/buffered-fields";
import TeamHrOverviewCards from "@/components/app/team-hr-overview-cards";
import TeamHrReportCard from "@/components/app/team-hr-report-card";
import TeamMemberEditDialog from "@/components/app/team-member-edit-dialog";
import TeamMemberProfileDialog from "@/components/app/team-member-profile-dialog";
import TeamMembersCard from "@/components/app/team-members-card";

export default function TeamHrView(props: any) {
  const {
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
    visibleTeamRows,
    selectedMemberId,
    setSelectedMemberId,
    setMemberProfileOpen,
    openContextMenu,
    openEditMember,
    copyTextToClipboard,
    removeMember,
    roleLabel,
    toFaNum,
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
    visibleHrAttendanceRows,
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
    setEditingMemberId,
    memberEditDraft,
    setMemberEditDraft,
    memberEditErrors,
    updateMember,
  } = props;

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
        visibleTeamRows={visibleTeamRows}
        selectedMemberId={selectedMemberId}
        setSelectedMemberId={setSelectedMemberId}
        setMemberProfileOpen={setMemberProfileOpen}
        openContextMenu={openContextMenu}
        openEditMember={openEditMember}
        copyTextToClipboard={copyTextToClipboard}
        removeMember={removeMember}
        roleLabel={roleLabel}
      />

      <TeamHrOverviewCards toFaNum={toFaNum} hrSummary={hrSummary} />

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="liquid-glass lift-on-hover">
          <CardHeader>
            <CardTitle>پرونده پرسنلی</CardTitle>
            <CardDescription>اطلاعات منابع انسانی عضو انتخاب‌شده را ثبت و نگهداری کن.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedMember ? (
              <p className="text-sm text-muted-foreground">ابتدا از جدول اعضای تیم یک عضو انتخاب کن.</p>
            ) : (
              <>
                <div className="rounded-lg border p-3 text-sm">
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
                    onChange={(v) => setHrProfileDraft((prev) => ({ ...prev, hireDate: v }))}
                  />
                  <DatePickerField
                    label="تاریخ تولد"
                    valueIso={hrProfileDraft.birthDate}
                    onChange={(v) => setHrProfileDraft((prev) => ({ ...prev, birthDate: v }))}
                  />
                </div>
                {isHrManager && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Select value={hrProfileDraft.contractType} onValueChange={(v) => setHrProfileDraft((prev) => ({ ...prev, contractType: v as any }))}>
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
                  <Button onClick={() => void saveHrProfile()}>
                    ذخیره پرونده
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="liquid-glass lift-on-hover">
          <CardHeader>
            <CardTitle>درخواست مرخصی</CardTitle>
            <CardDescription>ثبت، مشاهده و تایید/رد درخواست‌های مرخصی</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isHrManager && (
              <Select value={hrLeaveDraft.memberId} onValueChange={(v) => setHrLeaveDraft((prev) => ({ ...prev, memberId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="عضو" />
                </SelectTrigger>
                <SelectContent>
                  {activeTeamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hrLeaveErrors.memberId && <p className="text-xs text-destructive">{hrLeaveErrors.memberId}</p>}
            <Select value={hrLeaveDraft.leaveType} onValueChange={(v) => setHrLeaveDraft((prev) => ({ ...prev, leaveType: v as any }))}>
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
              <DatePickerField label="از تاریخ" valueIso={hrLeaveDraft.fromDate} onChange={(v) => setHrLeaveDraft((p) => ({ ...p, fromDate: v }))} />
              <DatePickerField label="تا تاریخ" valueIso={hrLeaveDraft.toDate} onChange={(v) => setHrLeaveDraft((p) => ({ ...p, toDate: v }))} />
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
                  <div key={row.id} className="rounded-lg border p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{teamMemberNameById.get(row.memberId) ?? "نامشخص"}</p>
                      <Badge variant={row.status === "pending" ? "secondary" : row.status === "approved" ? "default" : "destructive"}>
                        {HR_LEAVE_STATUS_ITEMS.find((x) => x.value === row.status)?.label ?? row.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {HR_LEAVE_TYPE_ITEMS.find((x) => x.value === row.leaveType)?.label ?? row.leaveType} | {isoToJalali(row.fromDate)} تا {isoToJalali(row.toDate)}
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

      <Card className="liquid-glass lift-on-hover">
        <CardHeader>
          <CardTitle>حضور و غیاب</CardTitle>
          <CardDescription>ثبت رکورد روزانه، محاسبه خودکار ساعت کار و مشاهده وضعیت ماهانه تیم</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">تعداد رکورد ماه</p>
              <p className="mt-1 text-xl font-bold">{toFaNum(String(hrAttendanceSummary.total))}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">نرخ حضور ماه</p>
              <p className="mt-1 text-xl font-bold">{toFaNum(String(hrAttendanceSummary.attendanceRate))}%</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">کل ساعت کاری</p>
              <p className="mt-1 text-xl font-bold">{toFaNum(String(hrAttendanceSummary.totalHours))}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">میانگین ساعت روزانه</p>
              <p className="mt-1 text-xl font-bold">{toFaNum(String(hrAttendanceSummary.avgHours))}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">غیبت ثبت‌شده</p>
              <p className="mt-1 text-xl font-bold text-destructive">{toFaNum(String(hrAttendanceSummary.absent))}</p>
            </div>
          </section>

          <div className="rounded-xl border p-4">
            <p className="mb-3 text-sm font-semibold">ثبت رکورد حضور جدید</p>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <DatePickerField
                label="ماه گزارش (شمسی)"
                valueIso={`${hrAttendanceMonth}-01`}
                onChange={(v) => {
                  const next = String(v ?? "").slice(0, 7);
                  if (/^\d{4}-\d{2}$/.test(next)) setHrAttendanceMonth(next);
                }}
              />
              <Select value={hrAttendanceDraft.memberId} onValueChange={(v) => setHrAttendanceDraft((prev) => ({ ...prev, memberId: v }))}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="عضو پرسنل" />
                </SelectTrigger>
                <SelectContent>
                  {activeTeamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DatePickerField label="تاریخ رکورد" valueIso={hrAttendanceDraft.date} onChange={(v) => setHrAttendanceDraft((prev) => ({ ...prev, date: v }))} />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-5">
              <Select value={hrAttendanceDraft.status} onValueChange={(v) => setHrAttendanceDraft((prev) => ({ ...prev, status: v as any }))}>
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
                onInput={(e) => {
                  const node = e.currentTarget;
                  const normalized = normalizeTimeInput(node.value);
                  if (node.value !== normalized) node.value = normalized;
                }}
                onBlur={(e) => commitHrAttendanceTime("checkIn", e.currentTarget.value)}
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
                onInput={(e) => {
                  const node = e.currentTarget;
                  const normalized = normalizeTimeInput(node.value);
                  if (node.value !== normalized) node.value = normalized;
                }}
                onBlur={(e) => commitHrAttendanceTime("checkOut", e.currentTarget.value)}
              />
              <div className="flex h-10 items-center rounded-md border bg-emerald-50 px-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                ساعت کار: {toFaNum(String(hrAttendanceDraft.status === "leave" ? 0 : calculateWorkHoursFromTime(hrAttendanceDraft.checkIn, hrAttendanceDraft.checkOut)))} ساعت
              </div>
              <BufferedInput className="h-10" placeholder="یادداشت کوتاه" value={hrAttendanceDraft.note} onCommit={(next) => setHrAttendanceDraft((prev) => ({ ...prev, note: next }))} />
            </div>
          </div>
          {hrAttendanceErrors.memberId && <p className="text-xs text-destructive">{hrAttendanceErrors.memberId}</p>}
          <div className="flex justify-end">
            <Button disabled={!isHrAdmin} onClick={() => void saveHrAttendanceRecord()}>
              ذخیره رکورد حضور
            </Button>
          </div>

          <div ref={hrAttendanceVirtual.ref} onScroll={hrAttendanceVirtual.onScroll} className="max-h-[62vh] overflow-auto rounded-xl border">
            <table className="min-w-full text-sm">
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
                    {hrAttendanceVirtual.windowState.paddingTop > 0 && (
                      <tr aria-hidden="true">
                        <td colSpan={isHrAdmin ? 8 : 7} style={{ height: hrAttendanceVirtual.windowState.paddingTop }} />
                      </tr>
                    )}
                    {visibleHrAttendanceRows.map((row) => (
                      <tr key={row.id} className="border-t hover:bg-muted/30">
                        <td className="px-2 py-2 font-medium">{teamMemberNameById.get(row.memberId) ?? "نامشخص"}</td>
                        <td className="px-2 py-2">{isoToJalali(row.date)}</td>
                        <td className="px-2 py-2">
                          <Badge variant="outline" className={hrAttendanceBadgeClass(row.status)}>
                            {HR_ATTENDANCE_STATUS_ITEMS.find((x) => x.value === row.status)?.label ?? row.status}
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
                    {hrAttendanceVirtual.windowState.paddingBottom > 0 && (
                      <tr aria-hidden="true">
                        <td colSpan={isHrAdmin ? 8 : 7} style={{ height: hrAttendanceVirtual.windowState.paddingBottom }} />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
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
      />

      <TeamMemberEditDialog
        memberEditOpen={memberEditOpen}
        setMemberEditOpen={setMemberEditOpen}
        setEditingMemberId={setEditingMemberId}
        memberEditDraft={memberEditDraft}
        setMemberEditDraft={setMemberEditDraft}
        memberEditErrors={memberEditErrors}
        memberInitials={memberInitials}
        pickAvatarForDraft={pickAvatarForDraft}
        updateMember={updateMember}
        teams={teams}
      />
    </>
  );
}
