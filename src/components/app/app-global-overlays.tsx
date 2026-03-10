import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BufferedInput, BufferedTextarea } from "@/components/ui/buffered-fields";
import { AppContextMenu } from "@/components/ui/app-context-menu";
import ToastStack from "@/components/app/toast-stack";
import { resolveAssetUrl } from "@/lib/asset-url";

export default function AppGlobalOverlays(props: any) {
  const {
    profileOpen,
    setProfileOpen,
    profileDraft,
    memberInitials,
    pickAvatarForProfile,
    profileErrors,
    setProfileDraft,
    settingsDraft,
    setSettingsDraft,
    saveProfile,
    saveSettings,
    confirmDialog,
    closeConfirmDialog,
    onboardingOpen,
    setOnboardingOpen,
    LazyOnboardingGuideDialog,
    ONBOARDING_STEPS,
    onboardingStep,
    setOnboardingStep,
    authUser,
    ONBOARDING_STORAGE_PREFIX,
    canAccessView,
    pushToast,
    setActiveView,
    contextMenu,
    closeContextMenu,
    toasts,
  } = props;

  return (
    <>
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent aria-describedby={undefined} className="liquid-glass max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>پروفایل شخصی</DialogTitle>
            <DialogDescription>تنظیمات پروفایل کاربر جاری</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {profileDraft.avatarDataUrl ? (
                <img src={resolveAssetUrl(profileDraft.avatarDataUrl)} alt="avatar" className="h-14 w-14 rounded-full border object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full border bg-muted text-sm font-semibold">
                  {memberInitials(profileDraft.fullName)}
                </div>
              )}
              <Input type="file" accept="image/*" onChange={(e) => void pickAvatarForProfile(e.target.files?.[0])} />
            </div>
            <BufferedInput
              placeholder="نام و نام خانوادگی"
              value={profileDraft.fullName}
              onCommit={(next) => setProfileDraft((p: any) => ({ ...p, fullName: next }))}
            />
            {profileErrors.fullName && <p className="text-xs text-destructive">{profileErrors.fullName}</p>}
            <BufferedInput
              placeholder="سمت"
              value={profileDraft.role}
              onCommit={(next) => setProfileDraft((p: any) => ({ ...p, role: next }))}
            />
            <BufferedInput
              placeholder="ایمیل"
              value={profileDraft.email}
              onCommit={(next) => setProfileDraft((p: any) => ({ ...p, email: next }))}
            />
            <BufferedInput
              placeholder="شماره تماس"
              value={profileDraft.phone}
              onCommit={(next) => setProfileDraft((p: any) => ({ ...p, phone: next }))}
            />
            <BufferedInput
              type="password"
              placeholder="رمز جدید (اختیاری)"
              value={profileDraft.password}
              onCommit={(next) => setProfileDraft((p: any) => ({ ...p, password: next }))}
            />
            {profileErrors.password && <p className="text-xs text-destructive">{profileErrors.password}</p>}
            <BufferedTextarea
              placeholder="بیو"
              value={profileDraft.bio}
              onCommit={(next) => setProfileDraft((p: any) => ({ ...p, bio: next }))}
            />
            <Select
              value={settingsDraft.general.theme}
              onValueChange={(v) => setSettingsDraft((prev: any) => ({ ...prev, general: { ...prev.general, theme: v as "light" | "dark" | "system" } }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="حالت نمایش" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">روشن</SelectItem>
                <SelectItem value="dark">تاریک</SelectItem>
                <SelectItem value="system">طبق سیستم</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setProfileOpen(false)}>
              بستن
            </Button>
            <Button
              onClick={async () => {
                await saveProfile();
                await saveSettings();
              }}
            >
              ذخیره پروفایل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) closeConfirmDialog(false);
        }}
      >
        <DialogContent aria-describedby={undefined} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => closeConfirmDialog(false)}>
              انصراف
            </Button>
            <Button variant={confirmDialog.destructive ? "destructive" : "default"} onClick={() => closeConfirmDialog(true)}>
              {confirmDialog.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Suspense fallback={null}>
        <LazyOnboardingGuideDialog
          open={onboardingOpen}
          onOpenChange={setOnboardingOpen}
          steps={ONBOARDING_STEPS}
          stepIndex={onboardingStep}
          onStepIndexChange={setOnboardingStep}
          onSkip={() => {
            if (authUser?.id) localStorage.setItem(`${ONBOARDING_STORAGE_PREFIX}:${authUser.id}`, "1");
            setOnboardingOpen(false);
          }}
          onApplyStep={(step: any) => {
            const targetView = step.targetView;
            if (!canAccessView(targetView)) {
              pushToast("دسترسی این بخش برای نقش فعلی شما محدود است.", "error");
            } else {
              setActiveView(targetView);
            }
            if (onboardingStep >= ONBOARDING_STEPS.length - 1) {
              if (authUser?.id) localStorage.setItem(`${ONBOARDING_STORAGE_PREFIX}:${authUser.id}`, "1");
              setOnboardingOpen(false);
            }
          }}
        />
      </Suspense>

      <AppContextMenu
        open={contextMenu.open}
        x={contextMenu.x}
        y={contextMenu.y}
        title={contextMenu.title}
        items={contextMenu.items}
        onClose={closeContextMenu}
      />
      <ToastStack toasts={toasts} />
    </>
  );
}
