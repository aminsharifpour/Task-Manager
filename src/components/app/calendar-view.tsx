// @ts-nocheck
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CalendarView(props: any) {
  const {
    goToPrevCalendarMonth,
    goToCurrentCalendarMonth,
    goToNextCalendarMonth,
    jalaliYearMonthLabel,
    safeCalendarYear,
    safeCalendarMonth,
    pad2,
    calendarStartOffset,
    calendarMonthDays,
    calendarSelectedIso,
    setCalendarSelectedIso,
    toFaNum,
    isoToJalali,
    selectedDayEvents,
  } = props;

  return (
    <>
      <Card className="liquid-glass lift-on-hover">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>تقویم شمسی</CardTitle>
            <CardDescription>تسک‌ها، پروژه‌ها و رویدادهای روزانه در تقویم نمایش داده می‌شوند.</CardDescription>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <Button type="button" variant="outline" size="sm" onClick={goToPrevCalendarMonth}>ماه قبل</Button>
            <Button type="button" variant="secondary" size="sm" onClick={goToCurrentCalendarMonth}>امروز</Button>
            <Button type="button" variant="outline" size="sm" onClick={goToNextCalendarMonth}>ماه بعد</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-3 text-center text-sm font-semibold">
            {jalaliYearMonthLabel(`${safeCalendarYear}-${pad2(safeCalendarMonth)}`)}
          </div>

          <div className="grid grid-cols-7 gap-1.5 md:hidden">
            {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((label) => (
              <div key={`m-${label}`} className="text-center text-[10px] text-muted-foreground">{label}</div>
            ))}
            {Array.from({ length: calendarStartOffset }).map((_, idx) => (
              <div key={`m-empty-${idx}`} className="h-12 rounded-md border border-dashed bg-muted/20" />
            ))}
            {calendarMonthDays.map((cell) => {
              const isSelected = calendarSelectedIso === cell.dateIso;
              return (
                <button
                  key={`m-${cell.dateIso}`}
                  type="button"
                  onClick={() => setCalendarSelectedIso(cell.dateIso)}
                  className={`relative h-12 rounded-md border text-center text-sm transition ${isSelected ? "border-primary bg-primary/10" : "hover:border-primary/50"}`}
                >
                  <span className="font-semibold">{toFaNum(String(cell.day))}</span>
                  {cell.events.length > 0 && (
                    <span className="absolute bottom-1 left-1 rounded-full bg-primary/15 px-1 text-[9px] text-primary">
                      {toFaNum(String(cell.events.length))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="hidden grid-cols-7 gap-2 md:grid">
            {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((label) => (
              <div key={label} className="text-center text-xs text-muted-foreground">{label}</div>
            ))}
            {Array.from({ length: calendarStartOffset }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-24 rounded-lg border border-dashed bg-muted/20" />
            ))}
            {calendarMonthDays.map((cell) => {
              const isSelected = calendarSelectedIso === cell.dateIso;
              return (
                <button
                  key={cell.dateIso}
                  type="button"
                  onClick={() => setCalendarSelectedIso(cell.dateIso)}
                  className={`h-24 rounded-lg border p-2 text-right transition ${isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{isoToJalali(cell.dateIso)}</span>
                    <span className="text-sm font-semibold">{toFaNum(String(cell.day))}</span>
                  </div>
                  <div className="space-y-1">
                    {cell.events.slice(0, 2).map((event) => (
                      <p
                        key={event.id}
                        className={`truncate text-[11px] ${event.tone === "task" ? "text-amber-700" : event.tone === "project" ? "text-emerald-700" : event.tone === "minute" ? "text-sky-700" : "text-violet-700"}`}
                      >
                        {event.title}
                      </p>
                    ))}
                    {cell.events.length > 2 && (
                      <p className="text-[11px] text-muted-foreground">+{toFaNum(String(cell.events.length - 2))} مورد دیگر</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="liquid-glass lift-on-hover">
        <CardHeader>
          <CardTitle>رویدادهای روز انتخاب‌شده</CardTitle>
          <CardDescription>{isoToJalali(calendarSelectedIso)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedDayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">برای این روز رویدادی ثبت نشده است.</p>
          ) : (
            selectedDayEvents.map((event) => (
              <div key={event.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{event.title}</p>
                  <Badge variant={event.tone === "task" ? "secondary" : event.tone === "minute" ? "outline" : "default"}>
                    {event.tone === "task" ? "تسک" : event.tone === "project" ? "پروژه" : event.tone === "minute" ? "جلسه" : "مالی"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{event.subtitle}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
