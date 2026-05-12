import { memo, type Dispatch, type SetStateAction } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type CalendarEventTone = "task" | "project" | "minute" | "finance";

type CalendarEventRow = {
  id: string;
  dateIso: string;
  title: string;
  subtitle: string;
  tone: CalendarEventTone;
};

type CalendarDayCell = {
  day: number;
  dateIso: string;
  events: CalendarEventRow[];
};

type CalendarViewProps = {
  shellSidebarCollapsed: boolean;
  goToPrevCalendarMonth: () => void;
  goToCurrentCalendarMonth: () => void;
  goToNextCalendarMonth: () => void;
  jalaliYearMonthLabel: (value: string) => string;
  safeCalendarYear: number;
  safeCalendarMonth: number;
  pad2: (value: number) => string;
  calendarStartOffset: number;
  calendarMonthDays: CalendarDayCell[];
  calendarSelectedIso: string;
  setCalendarSelectedIso: Dispatch<SetStateAction<string>>;
  toFaNum: (value: string) => string;
  isoToJalali: (value: string) => string;
  selectedDayEvents: CalendarEventRow[];
};

function CalendarView({
  shellSidebarCollapsed,
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
}: CalendarViewProps) {
  return (
    <>
      <Card className="oneui-calendar-shell">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/80">Calendar</p>
            <CardTitle className="oneui-page-title text-[1.55rem]">تقویم شمسی</CardTitle>
            <CardDescription>تسک‌ها، پروژه‌ها و رویدادهای روزانه در تقویم نمایش داده می‌شوند.</CardDescription>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <Button type="button" variant="outline" size="sm" onClick={goToPrevCalendarMonth}>
              ماه قبل
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={goToCurrentCalendarMonth}>
              امروز
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={goToNextCalendarMonth}>
              ماه بعد
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="oneui-calendar-month-label rounded-xl border border-border/16 bg-muted/12 p-3 text-center text-sm font-semibold">
            {jalaliYearMonthLabel(`${safeCalendarYear}-${pad2(safeCalendarMonth)}`)}
          </div>

          <div className="grid grid-cols-7 gap-1.5 md:hidden">
            {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((label) => (
              <div key={`m-${label}`} className="text-center text-[10px] text-muted-foreground">
                {label}
              </div>
            ))}
            {Array.from({ length: calendarStartOffset }).map((_, index) => (
              <div key={`m-empty-${index}`} className="h-12 rounded-lg bg-muted/16" />
            ))}
            {calendarMonthDays.map((cell) => {
              const isSelected = calendarSelectedIso === cell.dateIso;
              return (
                <button
                  key={`m-${cell.dateIso}`}
                  type="button"
                  onClick={() => setCalendarSelectedIso(cell.dateIso)}
                  className={`oneui-calendar-day relative h-12 rounded-lg border border-border/16 text-center text-sm transition ${isSelected ? "border-primary/24 bg-primary/8" : "bg-card hover:bg-muted/16"}`}
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

          <div className={`hidden grid-cols-7 gap-2 md:grid ${shellSidebarCollapsed ? "2xl:gap-3" : ""}`}>
            {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((label) => (
              <div key={label} className="text-center text-xs text-muted-foreground">
                {label}
              </div>
            ))}
            {Array.from({ length: calendarStartOffset }).map((_, index) => (
              <div key={`empty-${index}`} className="h-24 rounded-xl bg-muted/16" />
            ))}
            {calendarMonthDays.map((cell) => {
              const isSelected = calendarSelectedIso === cell.dateIso;
              return (
                <button
                  key={cell.dateIso}
                  type="button"
                  onClick={() => setCalendarSelectedIso(cell.dateIso)}
                  className={`oneui-calendar-day h-24 rounded-xl border border-border/16 p-2 text-right transition ${isSelected ? "border-primary/24 bg-primary/6" : "bg-card hover:bg-muted/16"}`}
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

      <Card className="oneui-calendar-shell">
        <CardHeader>
          <CardTitle>رویدادهای روز انتخاب‌شده</CardTitle>
          <CardDescription>{isoToJalali(calendarSelectedIso)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedDayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">برای این روز رویدادی ثبت نشده است.</p>
          ) : (
            selectedDayEvents.map((event) => (
              <div key={event.id} className="oneui-calendar-event-card rounded-xl border border-border/16 p-3">
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

export default memo(CalendarView);
