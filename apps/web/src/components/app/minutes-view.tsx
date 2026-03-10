// @ts-nocheck
import { FileText, Pencil, Trash2 } from "lucide-react";
import { BufferedInput, BufferedTextarea } from "@/components/ui/buffered-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function MinutesView(props: any) {
  const {
    MINUTE_TEMPLATES,
    applyMinuteTemplate,
    minuteDraft,
    setMinuteDraft,
    minuteErrors,
    DatePickerField,
    addMinute,
    minuteSearch,
    setMinuteSearch,
    minuteFrom,
    setMinuteFrom,
    minuteTo,
    setMinuteTo,
    visibleMinutes,
    minutesVirtual,
    visibleMinutesRows,
    setSelectedMinuteId,
    setMinuteDetailOpen,
    openContextMenu,
    copyTextToClipboard,
    removeMinute,
    isoToJalali,
    openEditMinute,
    minuteEditOpen,
    setMinuteEditOpen,
    setEditingMinuteId,
    minuteEditDraft,
    setMinuteEditDraft,
    minuteEditErrors,
    updateMinute,
    minuteDetailOpen,
    selectedMinuteId,
    setSelectedMinuteIdState,
    selectedMinute,
    setMinuteDetailOpenState,
    isoDateTimeToJalali,
  } = props;

  return (
    <>
      <Card className="liquid-glass lift-on-hover">
        <CardHeader>
          <CardTitle>ثبت صورتجلسه جدید</CardTitle>
          <CardDescription>صورتجلسه را ثبت کن تا همه اعضا به تصمیمات دسترسی داشته باشند.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">قالب آماده صورتجلسه</p>
            <div className="flex flex-wrap gap-2">
              {MINUTE_TEMPLATES.map((template) => (
                <Button key={template.id} type="button" size="sm" variant="outline" onClick={() => applyMinuteTemplate(template.id, "add")}>
                  {template.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">عنوان جلسه</p>
              <BufferedInput placeholder="عنوان جلسه" value={minuteDraft.title} onCommit={(next) => setMinuteDraft((p) => ({ ...p, title: next }))} />
              {minuteErrors.title && <p className="text-xs text-destructive">{minuteErrors.title}</p>}
            </div>
            <div>
              <DatePickerField label="تاریخ جلسه" valueIso={minuteDraft.dateIso} onChange={(v) => setMinuteDraft((p) => ({ ...p, dateIso: v }))} />
              {minuteErrors.dateIso && <p className="text-xs text-destructive">{minuteErrors.dateIso}</p>}
            </div>
          </div>
          <BufferedInput
            placeholder="حاضرین (اختیاری - با کاما جدا کن)"
            value={minuteDraft.attendees}
            onCommit={(next) => setMinuteDraft((p) => ({ ...p, attendees: next }))}
          />
          <div className="space-y-2">
            <BufferedTextarea placeholder="خلاصه جلسه" value={minuteDraft.summary} onCommit={(next) => setMinuteDraft((p) => ({ ...p, summary: next }))} />
            {minuteErrors.summary && <p className="text-xs text-destructive">{minuteErrors.summary}</p>}
          </div>
          <BufferedTextarea
            placeholder="تصمیمات جلسه (اختیاری)"
            value={minuteDraft.decisions}
            onCommit={(next) => setMinuteDraft((p) => ({ ...p, decisions: next }))}
          />
          <BufferedTextarea
            placeholder="اقدامات پیگیری (اختیاری)"
            value={minuteDraft.followUps}
            onCommit={(next) => setMinuteDraft((p) => ({ ...p, followUps: next }))}
          />
          <div className="flex justify-end">
            <Button onClick={addMinute}>ثبت صورتجلسه</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="liquid-glass lift-on-hover">
        <CardHeader>
          <CardTitle>لیست صورتجلسات</CardTitle>
          <CardDescription>امکان جستجو و فیلتر صورتجلسه‌ها</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3 md:items-end">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">جستجو</p>
              <Input placeholder="عنوان/خلاصه/حاضرین" value={minuteSearch} onChange={(e) => setMinuteSearch(e.target.value)} />
            </div>
            <DatePickerField label="از تاریخ" valueIso={minuteFrom} onChange={setMinuteFrom} clearable placeholder="بدون محدودیت" />
            <DatePickerField label="تا تاریخ" valueIso={minuteTo} onChange={setMinuteTo} clearable placeholder="بدون محدودیت" />
          </div>
          {visibleMinutes.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">صورتجلسه‌ای برای نمایش وجود ندارد.</div>
          ) : (
            <div ref={minutesVirtual.ref} onScroll={minutesVirtual.onScroll} className="max-h-[68vh] overflow-auto rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">عنوان</th>
                    <th className="px-3 py-2 text-right font-medium">تاریخ</th>
                    <th className="px-3 py-2 text-right font-medium">حاضرین</th>
                    <th className="px-3 py-2 text-right font-medium">خلاصه</th>
                    <th className="px-3 py-2 text-right font-medium">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {minutesVirtual.windowState.paddingTop > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={5} style={{ height: minutesVirtual.windowState.paddingTop }} />
                    </tr>
                  )}
                  {visibleMinutesRows.map((m) => (
                    <tr
                      key={m.id}
                      className="cursor-pointer border-t transition-colors hover:bg-muted/30"
                      onClick={() => {
                        setSelectedMinuteId(m.id);
                        setMinuteDetailOpen(true);
                      }}
                      onContextMenu={(event) =>
                        openContextMenu(event, `صورتجلسه: ${m.title}`, [
                          {
                            id: "minute-open",
                            label: "نمایش جزئیات",
                            icon: FileText,
                            onSelect: () => {
                              setSelectedMinuteId(m.id);
                              setMinuteDetailOpen(true);
                            },
                          },
                          { id: "minute-edit", label: "ویرایش صورتجلسه", icon: Pencil, onSelect: () => openEditMinute(m) },
                          {
                            id: "minute-copy-title",
                            label: "کپی عنوان",
                            icon: FileText,
                            onSelect: () => {
                              void copyTextToClipboard(m.title, "عنوان صورتجلسه کپی شد.");
                            },
                          },
                          {
                            id: "minute-delete",
                            label: "حذف صورتجلسه",
                            icon: Trash2,
                            tone: "danger",
                            onSelect: () => {
                              void removeMinute(m.id);
                            },
                          },
                        ])
                      }
                    >
                      <td className="px-3 py-2 font-medium">{m.title}</td>
                      <td className="px-3 py-2">{isoToJalali(m.date)}</td>
                      <td className="max-w-[220px] truncate px-3 py-2">{m.attendees || "-"}</td>
                      <td className="max-w-[360px] truncate px-3 py-2 text-muted-foreground">{m.summary}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditMinute(m);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              void removeMinute(m.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {minutesVirtual.windowState.paddingBottom > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={5} style={{ height: minutesVirtual.windowState.paddingBottom }} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={minuteEditOpen}
        onOpenChange={(open) => {
          setMinuteEditOpen(open);
          if (!open) setEditingMinuteId(null);
        }}
      >
        <DialogContent aria-describedby={undefined} className="liquid-glass">
          <DialogHeader>
            <DialogTitle>ویرایش صورتجلسه</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">قالب آماده صورتجلسه</p>
              <div className="flex flex-wrap gap-2">
                {MINUTE_TEMPLATES.map((template) => (
                  <Button key={template.id} type="button" size="sm" variant="outline" onClick={() => applyMinuteTemplate(template.id, "edit")}>
                    {template.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">عنوان جلسه</p>
                <BufferedInput placeholder="عنوان جلسه" value={minuteEditDraft.title} onCommit={(next) => setMinuteEditDraft((p) => ({ ...p, title: next }))} />
                {minuteEditErrors.title && <p className="text-xs text-destructive">{minuteEditErrors.title}</p>}
              </div>
              <div className="space-y-2">
                <DatePickerField label="تاریخ جلسه" valueIso={minuteEditDraft.dateIso} onChange={(v) => setMinuteEditDraft((p) => ({ ...p, dateIso: v }))} />
                {minuteEditErrors.dateIso && <p className="text-xs text-destructive">{minuteEditErrors.dateIso}</p>}
              </div>
            </div>
            <BufferedInput placeholder="حاضرین" value={minuteEditDraft.attendees} onCommit={(next) => setMinuteEditDraft((p) => ({ ...p, attendees: next }))} />
            <BufferedTextarea placeholder="خلاصه جلسه" value={minuteEditDraft.summary} onCommit={(next) => setMinuteEditDraft((p) => ({ ...p, summary: next }))} />
            {minuteEditErrors.summary && <p className="text-xs text-destructive">{minuteEditErrors.summary}</p>}
            <BufferedTextarea placeholder="تصمیمات جلسه" value={minuteEditDraft.decisions} onCommit={(next) => setMinuteEditDraft((p) => ({ ...p, decisions: next }))} />
            <BufferedTextarea placeholder="اقدامات پیگیری" value={minuteEditDraft.followUps} onCommit={(next) => setMinuteEditDraft((p) => ({ ...p, followUps: next }))} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setMinuteEditOpen(false)}>
              بستن
            </Button>
            <Button onClick={updateMinute}>ذخیره تغییرات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={minuteDetailOpen}
        onOpenChange={(open) => {
          setMinuteDetailOpenState(open);
          if (!open) setSelectedMinuteIdState(null);
        }}
      >
        <DialogContent aria-describedby={undefined} className="liquid-glass max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedMinute?.title ?? "جزئیات صورتجلسه"}</DialogTitle>
            <DialogDescription>نمایش کامل اطلاعات جلسه در یک نگاه</DialogDescription>
          </DialogHeader>
          {!selectedMinute ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">صورتجلسه انتخاب‌شده یافت نشد.</div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="mb-1 text-xs text-muted-foreground">تاریخ جلسه</p>
                  <p className="font-medium">{isoToJalali(selectedMinute.date)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="mb-1 text-xs text-muted-foreground">زمان ثبت</p>
                  <p className="font-medium">{isoDateTimeToJalali(selectedMinute.createdAt)}</p>
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <p className="mb-1 text-xs text-muted-foreground">حاضرین</p>
                <p className="whitespace-pre-wrap leading-7">{selectedMinute.attendees || "-"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="mb-1 text-xs text-muted-foreground">خلاصه جلسه</p>
                <p className="whitespace-pre-wrap leading-7">{selectedMinute.summary || "-"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="mb-1 text-xs text-muted-foreground">تصمیمات جلسه</p>
                <p className="whitespace-pre-wrap leading-7">{selectedMinute.decisions || "-"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="mb-1 text-xs text-muted-foreground">اقدامات پیگیری</p>
                <p className="whitespace-pre-wrap leading-7">{selectedMinute.followUps || "-"}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setMinuteDetailOpenState(false)}>
              بستن
            </Button>
            {selectedMinute && (
              <Button
                onClick={() => {
                  setMinuteDetailOpenState(false);
                  openEditMinute(selectedMinute);
                }}
              >
                ویرایش
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
