import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type OnboardingStepItem = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  targetView: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  steps: OnboardingStepItem[];
  stepIndex: number;
  onStepIndexChange: (next: number) => void;
  onSkip: () => void;
  onApplyStep: (step: OnboardingStepItem) => void;
};

export default function OnboardingGuideDialog({
  open,
  onOpenChange,
  steps,
  stepIndex,
  onStepIndexChange,
  onSkip,
  onApplyStep,
}: Props) {
  const safeStep = Math.min(Math.max(stepIndex, 0), Math.max(0, steps.length - 1));
  const current = steps[safeStep];
  const isLast = safeStep >= steps.length - 1;

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>راهنمای شروع سریع</DialogTitle>
          <DialogDescription>در ۳ گام با بخش‌های اصلی نرم‌افزار آشنا شو.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-2xl border bg-muted/25 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-primary">{current.icon}</span>
              <p className="font-semibold">{current.title}</p>
            </div>
            <p className="text-sm text-muted-foreground">{current.description}</p>
          </div>
          <div className="flex items-center justify-center gap-2">
            {steps.map((step, idx) => (
              <span
                key={`onboarding-dot-${step.id}`}
                className={`h-2.5 rounded-full transition-all ${idx === safeStep ? "w-6 bg-primary" : "w-2.5 bg-muted-foreground/40"}`}
              />
            ))}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={onSkip}>
            بعدا
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={safeStep === 0}
              onClick={() => onStepIndexChange(Math.max(0, safeStep - 1))}
            >
              قبلی
            </Button>
            <Button
              type="button"
              onClick={() => {
                onApplyStep(current);
                if (!isLast) {
                  onStepIndexChange(safeStep + 1);
                }
              }}
            >
              {isLast ? "شروع کار" : "مرحله بعد"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
