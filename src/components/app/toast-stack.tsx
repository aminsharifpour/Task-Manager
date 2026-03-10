import { AlertTriangle, CheckCircle2, Info, Trash2 } from "lucide-react";

export type ToastItemViewModel = {
  id: string;
  message: string;
  tone: "success" | "error";
};

type Props = {
  toasts: ToastItemViewModel[];
};

const getToastVisual = (toast: ToastItemViewModel) => {
  const msg = String(toast.message ?? "");
  const isDelete = /حذف|ریست/.test(msg);
  const isError = toast.tone === "error" || /خطا|ناموفق|رد شد|منقضی|نشد/.test(msg);
  const isSuccess = /ثبت|ذخیره|ایجاد|اضافه شد|ویرایش|به‌روزرسانی|ارسال|فوروارد|دانلود/.test(msg);
  if (isDelete) {
    return {
      icon: <Trash2 className="h-4 w-4" />,
      container: "border-rose-300/70 bg-rose-50/95 text-rose-900 dark:border-rose-700/60 dark:bg-rose-900/30 dark:text-rose-100",
    };
  }
  if (isError) {
    return {
      icon: <AlertTriangle className="h-4 w-4" />,
      container: "border-rose-300/70 bg-rose-50/95 text-rose-900 dark:border-rose-700/60 dark:bg-rose-900/30 dark:text-rose-100",
    };
  }
  if (isSuccess) {
    return {
      icon: <CheckCircle2 className="h-4 w-4" />,
      container: "border-emerald-300/70 bg-emerald-50/95 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-900/30 dark:text-emerald-100",
    };
  }
  return {
    icon: <Info className="h-4 w-4" />,
    container: "border-slate-300/70 bg-slate-50/95 text-slate-900 dark:border-slate-700/60 dark:bg-slate-900/30 dark:text-slate-100",
  };
};

export default function ToastStack({ toasts }: Props) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[320px] flex-col gap-2">
      {toasts.map((toast) => {
        const visual = getToastVisual(toast);
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border px-3 py-2 text-sm shadow-sm backdrop-blur-sm ${visual.container}`}
          >
            <div className="flex items-center gap-2">
              {visual.icon}
              <span className="line-clamp-2">{toast.message}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
