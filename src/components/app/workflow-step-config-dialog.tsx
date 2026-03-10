import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import WorkflowStepEditor, { type WorkflowStepEditorRow } from "@/components/app/workflow-step-editor";

export default function WorkflowStepConfigDialog({
  title,
  rows,
  members,
  summary,
  onSave,
}: {
  title: string;
  rows: WorkflowStepEditorRow[];
  members: Array<{ id: string; fullName: string }>;
  summary: string;
  onSave: (next: WorkflowStepEditorRow[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [localRows, setLocalRows] = useState<WorkflowStepEditorRow[]>(rows);

  useEffect(() => {
    if (!open) setLocalRows(rows);
  }, [rows, open]);

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="truncate text-xs">{summary}</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => setOpen(true)}>
          <Settings2 className="h-3.5 w-3.5" />
          تنظیم ورک‌فلو
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="liquid-glass h-[92vh] w-[96vw] max-w-[1100px] overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <WorkflowStepEditor title="طراحی مراحل" rows={localRows} onChange={setLocalRows} members={members} />
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button
              type="button"
              onClick={() => {
                onSave(localRows);
                setOpen(false);
              }}
            >
              ذخیره ورک‌فلو
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
