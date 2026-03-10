import type { Dispatch, SetStateAction } from "react";
import { normalizeUiMessage } from "@/lib/api-client";

type Args = {
  apiRequest: <T>(path: string, init?: RequestInit) => Promise<T>;
  pushToast: (message: string, tone?: "success" | "error") => void;
  confirmAction: (message: string, options?: any) => Promise<boolean>;
  fileToOptimizedAvatar: (file: File) => Promise<string>;
  todayIso: () => string;
  mergeSettingsWithDefaults: (incoming: any) => any;
  settingsDraft: any;
  setSettingsDraft: Dispatch<SetStateAction<any>>;
  setSettingsErrors: (errors: Record<string, string>) => void;
  setSettingsBusy: (busy: boolean) => void;
  webhookTestBusy: boolean;
  setWebhookTestBusy: (busy: boolean) => void;
  profileDraft: any;
  setProfileDraft: Dispatch<SetStateAction<any>>;
  setProfileErrors: (errors: Record<string, string>) => void;
  currentMember: any;
  setTeamMembers: Dispatch<SetStateAction<any[]>>;
  setProfileOpen: (open: boolean) => void;
  backupImportText: string;
};

export const useSettingsProfileActions = ({
  apiRequest,
  pushToast,
  confirmAction,
  fileToOptimizedAvatar,
  todayIso,
  mergeSettingsWithDefaults,
  settingsDraft,
  setSettingsDraft,
  setSettingsErrors,
  setSettingsBusy,
  webhookTestBusy,
  setWebhookTestBusy,
  profileDraft,
  setProfileDraft,
  setProfileErrors,
  currentMember,
  setTeamMembers,
  setProfileOpen,
  backupImportText,
}: Args) => {
  const pickLogoForSettings = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSettingsErrors({ logo: "فقط فایل تصویری قابل انتخاب است." });
      return;
    }
    try {
      const logoDataUrl = await fileToOptimizedAvatar(file);
      setSettingsDraft((prev: any) => ({ ...prev, general: { ...prev.general, logoDataUrl } }));
      setSettingsErrors({});
    } catch {
      setSettingsErrors({ logo: "پردازش لوگو انجام نشد." });
    }
  };

  const pickAvatarForProfile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileErrors({ fullName: "فقط فایل تصویری قابل انتخاب است." });
      return;
    }
    try {
      const avatarDataUrl = await fileToOptimizedAvatar(file);
      setProfileDraft((prev: any) => ({ ...prev, avatarDataUrl }));
      setProfileErrors({});
    } catch {
      setProfileErrors({ fullName: "پردازش تصویر انجام نشد." });
    }
  };

  const setWebhookEventEnabled = (eventKey: string, enabled: boolean) => {
    setSettingsDraft((prev: any) => {
      const current = prev.integrations.webhook.events ?? [];
      const next = enabled ? Array.from(new Set([...current, eventKey])) : current.filter((item: string) => item !== eventKey);
      return {
        ...prev,
        integrations: {
          ...prev.integrations,
          webhook: {
            ...prev.integrations.webhook,
            events: next,
          },
        },
      };
    });
  };

  const testWebhookConnection = async () => {
    if (webhookTestBusy) return;
    setWebhookTestBusy(true);
    try {
      await apiRequest<{ ok: boolean }>("/api/integrations/webhook/test", {
        method: "POST",
        body: JSON.stringify({ webhook: settingsDraft.integrations.webhook }),
      });
      pushToast("Webhook با موفقیت تست شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "تست Webhook ناموفق بود.");
      pushToast(msg || "تست Webhook ناموفق بود.", "error");
    } finally {
      setWebhookTestBusy(false);
    }
  };

  const saveSettings = async () => {
    if (!(await confirmAction("تنظیمات ذخیره شود؟", { title: "ذخیره تنظیمات" }))) return;
    setSettingsBusy(true);
    setSettingsErrors({});
    try {
      const saved = await apiRequest<any>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(settingsDraft),
      });
      setSettingsDraft(mergeSettingsWithDefaults(saved));
      pushToast("تنظیمات ذخیره شد.");
    } catch {
      setSettingsErrors({ save: "ذخیره تنظیمات ناموفق بود." });
      pushToast("ذخیره تنظیمات ناموفق بود.", "error");
    } finally {
      setSettingsBusy(false);
    }
  };

  const saveProfile = async () => {
    if (!currentMember) return;
    const next: Record<string, string> = {};
    if (!profileDraft.fullName.trim()) next.fullName = "نام الزامی است.";
    if (profileDraft.password.trim() && profileDraft.password.trim().length < 4) {
      next.password = "رمز عبور باید حداقل ۴ کاراکتر باشد.";
    }
    if (Object.keys(next).length) {
      setProfileErrors(next);
      return;
    }
    if (!(await confirmAction("تغییرات پروفایل ذخیره شود؟", { title: "ذخیره پروفایل" }))) return;
    try {
      const updated = await apiRequest<any>(`/api/team-members/${currentMember.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: profileDraft.fullName.trim(),
          role: profileDraft.role.trim(),
          email: profileDraft.email.trim(),
          phone: profileDraft.phone.trim(),
          password: profileDraft.password.trim(),
          bio: profileDraft.bio.trim(),
          avatarDataUrl: profileDraft.avatarDataUrl,
          appRole: currentMember.appRole ?? "member",
          isActive: currentMember.isActive !== false,
        }),
      });
      setTeamMembers((prev) => prev.map((member) => (member.id === updated.id ? updated : member)));
      setProfileOpen(false);
      pushToast("پروفایل شخصی ذخیره شد.");
    } catch {
      setProfileErrors({ fullName: "ذخیره پروفایل ناموفق بود." });
      pushToast("ذخیره پروفایل ناموفق بود.", "error");
    }
  };

  const exportFullBackup = async () => {
    try {
      const data = await apiRequest<Record<string, unknown>>("/api/backup/export");
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob(["\uFEFF" + json], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `backup-${todayIso()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      pushToast("بکاپ JSON دانلود شد.");
    } catch {
      pushToast("خروجی بکاپ ناموفق بود.", "error");
    }
  };

  const importFullBackup = async () => {
    const raw = backupImportText.trim();
    if (!raw) {
      setSettingsErrors({ backup: "متن JSON بکاپ را وارد کن." });
      return;
    }
    if (
      !(await confirmAction("بکاپ وارد شود؟ داده‌های فعلی بازنویسی می‌شوند.", {
        title: "ایمپورت بکاپ",
        confirmLabel: "ایمپورت",
      }))
    ) {
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      await apiRequest<{ ok: boolean }>("/api/backup/import", {
        method: "POST",
        body: JSON.stringify(parsed),
      });
      window.location.reload();
    } catch {
      setSettingsErrors({ backup: "ایمپورت بکاپ ناموفق بود (JSON نامعتبر یا داده ناسازگار)." });
      pushToast("ایمپورت بکاپ ناموفق بود.", "error");
    }
  };

  const resetAllData = async () => {
    if (
      !(await confirmAction("تمام داده‌ها ریست شود؟ این عمل قابل بازگشت نیست.", {
        title: "ریست کامل داده‌ها",
        confirmLabel: "ریست",
        destructive: true,
      }))
    ) {
      return;
    }
    try {
      await apiRequest<{ ok: boolean }>("/api/backup/reset", { method: "POST" });
      window.location.reload();
    } catch {
      pushToast("ریست داده‌ها ناموفق بود.", "error");
    }
  };

  return {
    pickLogoForSettings,
    pickAvatarForProfile,
    setWebhookEventEnabled,
    testWebhookConnection,
    saveSettings,
    saveProfile,
    exportFullBackup,
    importFullBackup,
    resetAllData,
  };
};
