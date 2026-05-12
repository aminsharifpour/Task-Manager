// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { FileText, Pencil, Trash2 } from "lucide-react";
import { BufferedInput, BufferedTextarea } from "@/components/ui/buffered-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/ui/table-pagination";

function MinuteFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="minute-form-section">
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? <p className="text-xs leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function MinuteDisclosureSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="minute-form-section">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold marker:hidden">
        <span>{title}</span>
        <span className="text-[11px] font-normal text-muted-foreground">{description || "برای باز کردن بزن"}</span>
      </summary>
      <div className="border-t border-border/10 px-4 py-3">{children}</div>
    </details>
  );
}

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

  const [minutesPage, setMinutesPage] = useState(1);
  const [minutesPageSize, setMinutesPageSize] = useState(20);
  const paginatedMinutes = useMemo(() => {
    const start = (minutesPage - 1) * minutesPageSize;
    return visibleMinutes.slice(start, start + minutesPageSize);
  }, [minutesPage, minutesPageSize, visibleMinutes]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(visibleMinutes.length / minutesPageSize));
    if (minutesPage > totalPages) setMinutesPage(totalPages);
  }, [minutesPage, minutesPageSize, visibleMinutes.length]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>ثبت صورتجلسه جدید</CardTitle>
          <CardDescription>فقط اطلاعات اصلی جلسه را ثبت کن. جزئیات تکمیلی در بخش جداگانه قرار گرفته‌اند.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MinuteFormSection title="اطلاعات اصلی">
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
          </MinuteFormSection>

          <MinuteFormSection title="شرکت‌کنندگان" description="نام حاضرین را با ویرگول از هم جدا کن.">
            <BufferedInput
              placeholder="مثلا: علی رضایی، مریم احمدی، ..."
              value={minuteDraft.attendees}
              onCommit={(next) => setMinuteDraft((p) => ({ ...p, attendees: next }))}
            />
          </MinuteFormSection>

          <MinuteFormSection title="خلاصه جلسه">
            <div className="space-y-2">
              <BufferedTextarea className="min-h-28" placeholder="خلاصه جلسه" value={minuteDraft.summary} onCommit={(next) => setMinuteDraft((p) => ({ ...p, summary: next }))} />
              {minuteErrors.summary && <p className="text-xs text-destructive">{minuteErrors.summary}</p>}
            </div>
          </MinuteFormSection>
          <MinuteDisclosureSection title="تنظیمات تکمیلی" description="قالب آماده، تصمیمات و اقدامات پیگیری">
            <div className="space-y-4">
              <MinuteFormSection title="قالب آماده" description="اگر صورتجلسه الگوی تکراری دارد، از این دکمه‌ها شروع کن.">
                <div className="flex flex-wrap gap-2">
                  {MINUTE_TEMPLATES.map((template) => (
                    <Button key={template.id} type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => applyMinuteTemplate(template.id, "add")}>
                      {template.label}
                    </Button>
                  ))}
                </div>
              </MinuteFormSection>
              <MinuteFormSection title="محتوای تکمیلی">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">تصمیمات جلسه</p>
                  <BufferedTextarea
                    className="min-h-24"
                    placeholder="تصمیمات جلسه (اختیاری)"
                    value={minuteDraft.decisions}
                    onCommit={(next) => setMinuteDraft((p) => ({ ...p, decisions: next }))}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">اقدامات پیگیری</p>
                  <BufferedTextarea
                    className="min-h-24"
                    placeholder="اقدامات پیگیری (اختیاری)"
                    value={minuteDraft.followUps}
                    onCommit={(next) => setMinuteDraft((p) => ({ ...p, followUps: next }))}
                  />
                </div>
              </MinuteFormSection>
            </div>
          </MinuteDisclosureSection>
          <div className="flex justify-end">
            <Button onClick={addMinute}>ایجاد صورتجلسه</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
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
            <div className="rounded-lg bg-muted/14 p-8 text-center text-sm text-muted-foreground">صورتجلسه‌ای برای نمایش وجود ندارد.</div>
          ) : (
            <>
              <div className="minute-table-shell">
                <div ref={minutesVirtual.ref} onScroll={minutesVirtual.onScroll} className="minute-table-scroll max-h-[68vh] overflow-auto">
                  <table className="minute-table min-w-full text-sm">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-right font-medium">عنوان</th>
                        <th className="px-4 py-3 text-right font-medium">تاریخ</th>
                        <th className="px-4 py-3 text-right font-medium">حاضرین</th>
                        <th className="px-4 py-3 text-right font-medium">خلاصه</th>
                        <th className="px-4 py-3 text-right font-medium">عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedMinutes.map((m) => (
                        <tr
                          key={m.id}
                          className="cursor-pointer transition-colors"
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
                          <td className="px-4 py-3 font-medium">{m.title}</td>
                          <td className="px-4 py-3">{isoToJalali(m.date)}</td>
                          <td className="max-w-[220px] truncate px-4 py-3">{m.attendees || "-"}</td>
                          <td className="max-w-[360px] truncate px-4 py-3 text-muted-foreground">{m.summary}</td>
                          <td className="px-4 py-3">
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
                    </tbody>
                  </table>
                </div>
              </div>
              <TablePagination
                page={minutesPage}
                pageSize={minutesPageSize}
                totalItems={visibleMinutes.length}
                onPageChange={setMinutesPage}
                onPageSizeChange={(pageSize) => {
                  setMinutesPageSize(pageSize);
                  setMinutesPage(1);
                }}
                toFaNum={props.toFaNum}
              />
            </>
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
        <DialogContent aria-describedby={undefined} className="max-h-[90vh] overflow-y-auto bg-card shadow-lg sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>ویرایش صورتجلسه</DialogTitle>
          </DialogHeader>
          <div className="dialog-form-grid">
            <div className="dialog-form-side dialog-form-stack">
              <MinuteFormSection title="اطلاعات اصلی">
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
              </MinuteFormSection>
            </div>
            <div className="dialog-form-main dialog-form-stack">
              <MinuteFormSection title="شرکت‌کنندگان" description="نام حاضرین را با ویرگول از هم جدا کن.">
              <BufferedInput placeholder="مثلا: علی رضایی، مریم احمدی، ..." value={minuteEditDraft.attendees} onCommit={(next) => setMinuteEditDraft((p) => ({ ...p, attendees: next }))} />
              </MinuteFormSection>
              <MinuteFormSection title="خلاصه جلسه">
              <div className="space-y-2">
                <BufferedTextarea className="min-h-28" placeholder="خلاصه جلسه" value={minuteEditDraft.summary} onCommit={(next) => setMinuteEditDraft((p) => ({ ...p, summary: next }))} />
                {minuteEditErrors.summary && <p className="text-xs text-destructive">{minuteEditErrors.summary}</p>}
              </div>
              </MinuteFormSection>
              <MinuteDisclosureSection title="تنظیمات تکمیلی" description="قالب آماده، تصمیمات و اقدامات پیگیری">
                <div className="space-y-4">
                  <MinuteFormSection title="قالب آماده" description="در صورت نیاز، الگوی آماده را روی فرم اعمال کن.">
                  <div className="flex flex-wrap gap-2">
                    {MINUTE_TEMPLATES.map((template) => (
                      <Button key={template.id} type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => applyMinuteTemplate(template.id, "edit")}>
                        {template.label}
                      </Button>
                    ))}
                  </div>
                  </MinuteFormSection>
                  <MinuteFormSection title="محتوای تکمیلی">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">تصمیمات جلسه</p>
                      <BufferedTextarea className="min-h-24" placeholder="تصمیمات جلسه" value={minuteEditDraft.decisions} onCommit={(next) => setMinuteEditDraft((p) => ({ ...p, decisions: next }))} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">اقدامات پیگیری</p>
                      <BufferedTextarea className="min-h-24" placeholder="اقدامات پیگیری" value={minuteEditDraft.followUps} onCommit={(next) => setMinuteEditDraft((p) => ({ ...p, followUps: next }))} />
                    </div>
                  </MinuteFormSection>
                </div>
              </MinuteDisclosureSection>
            </div>
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
        <DialogContent aria-describedby={undefined} className="max-h-[88vh] overflow-y-auto bg-card shadow-lg sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedMinute?.title ?? "جزئیات صورتجلسه"}</DialogTitle>
            <DialogDescription>نمایش کامل اطلاعات جلسه در یک نگاه</DialogDescription>
          </DialogHeader>
          {!selectedMinute ? (
            <div className="rounded-lg bg-muted/10 p-4 text-sm text-muted-foreground">صورتجلسه انتخاب‌شده یافت نشد.</div>
          ) : (
            <div className="dialog-form-grid text-sm">
              <div className="dialog-form-side dialog-form-stack">
                <MinuteFormSection title="اطلاعات اصلی">
                  <div className="grid gap-3">
                    <div className="app-minimal-panel p-3">
                      <p className="mb-1 text-xs text-muted-foreground">عنوان جلسه</p>
                      <p className="font-semibold">{selectedMinute.title || "-"}</p>
                    </div>
                    <div className="app-minimal-panel p-3">
                      <p className="mb-1 text-xs text-muted-foreground">تاریخ جلسه</p>
                      <p className="font-semibold">{isoToJalali(selectedMinute.date)}</p>
                    </div>
                    <div className="app-minimal-panel p-3">
                      <p className="mb-1 text-xs text-muted-foreground">زمان ثبت</p>
                      <p className="font-semibold">{isoDateTimeToJalali(selectedMinute.createdAt)}</p>
                    </div>
                  </div>
                </MinuteFormSection>
              </div>

              <div className="dialog-form-main dialog-form-stack">
                <MinuteFormSection title="شرکت‌کنندگان" description="فهرست افراد حاضر در جلسه">
                  <div className="app-minimal-panel p-3">
                    <p className="whitespace-pre-wrap leading-7">{selectedMinute.attendees || "-"}</p>
                  </div>
                </MinuteFormSection>

                <MinuteFormSection title="خلاصه جلسه">
                  <div className="app-minimal-panel p-3">
                    <p className="whitespace-pre-wrap leading-7">{selectedMinute.summary || "-"}</p>
                  </div>
                </MinuteFormSection>

                <MinuteDisclosureSection title="جزئیات تکمیلی" description="تصمیمات و اقدامات پیگیری">
                  <div className="space-y-4">
                    <MinuteFormSection title="تصمیمات جلسه">
                      <div className="app-minimal-panel p-3">
                        <p className="whitespace-pre-wrap leading-7">{selectedMinute.decisions || "تصمیمی ثبت نشده است."}</p>
                      </div>
                    </MinuteFormSection>
                    <MinuteFormSection title="اقدامات پیگیری">
                      <div className="app-minimal-panel p-3">
                        <p className="whitespace-pre-wrap leading-7">{selectedMinute.followUps || "اقدام پیگیری ثبت نشده است."}</p>
                      </div>
                    </MinuteFormSection>
                  </div>
                </MinuteDisclosureSection>
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
