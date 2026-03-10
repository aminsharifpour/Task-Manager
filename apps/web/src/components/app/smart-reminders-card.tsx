import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type SmartReminderViewModel = {
  id: string;
  title: string;
  description: string;
  tone: "success" | "error";
  targetView: string;
  taskId?: string;
};

type Props = {
  reminders: SmartReminderViewModel[];
  onView: (reminder: SmartReminderViewModel) => void;
};

export default function SmartRemindersCard({ reminders, onView }: Props) {
  if (reminders.length === 0) return null;

  return (
    <Card className="liquid-glass lift-on-hover">
      <CardHeader>
        <CardTitle>یادآورهای هوشمند</CardTitle>
        <CardDescription>اقدام‌های فوری بر اساس وضعیت تسک‌ها و بودجه</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {reminders.map((reminder) => (
          <div
            key={reminder.id}
            className={`rounded-lg border p-3 ${
              reminder.tone === "error" ? "border-destructive/50 bg-destructive/5" : "border-emerald-500/40 bg-emerald-500/5"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm font-semibold">{reminder.title}</p>
                <p className="text-xs text-muted-foreground">{reminder.description}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onView(reminder);
                }}
              >
                مشاهده
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
