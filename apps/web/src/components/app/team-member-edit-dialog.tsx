import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { BufferedInput, BufferedTextarea } from "@/components/ui/buffered-fields";
import { NativeSelect } from "@/components/ui/native-select";
import { resolveAssetUrl } from "@/lib/asset-url";

const moduleAccessDefaults = (appRole: "admin" | "manager" | "member") => ({
  tasks: true,
  projects: true,
  minutes: true,
  accounting: true,
  calendar: true,
  chat: true,
  notifications: true,
  team: appRole !== "member",
  audit: appRole !== "member",
  reports: true,
});
const permissionOverridesDefaults = (appRole: "admin" | "manager" | "member") => ({
  projectCreate: appRole !== "member",
  projectUpdate: appRole !== "member",
  projectDelete: appRole === "admin",
  taskCreate: appRole !== "member",
  taskUpdate: appRole !== "member",
  taskDelete: appRole === "admin",
  taskChangeStatus: true,
  teamCreate: appRole === "admin",
  teamUpdate: appRole !== "member",
  teamDelete: appRole === "admin",
});
const policyOverridesDefaults = (appRole: "admin" | "manager" | "member") => {
  if (appRole === "admin") {
    return {
      project: { view: "all", create: "all", update: "all", delete: "all", approve: "all" },
      task: { view: "all", create: "all", update: "all", delete: "all", approve: "all" },
      teamMember: { view: "all", create: "all", update: "all", delete: "all", approve: "all" },
    };
  }
  if (appRole === "manager") {
    return {
      project: { view: "team", create: "team", update: "owner", delete: "none", approve: "none" },
      task: { view: "team", create: "team", update: "team", delete: "none", approve: "team" },
      teamMember: { view: "team", create: "none", update: "team", delete: "none", approve: "none" },
    };
  }
  return {
    project: { view: "project", create: "none", update: "none", delete: "none", approve: "none" },
    task: { view: "project", create: "none", update: "assigned", delete: "none", approve: "assigned" },
    teamMember: { view: "team", create: "none", update: "self", delete: "none", approve: "none" },
  };
};
const PERMISSION_ITEMS = [
  { action: "projectCreate", label: "ایجاد پروژه" },
  { action: "projectUpdate", label: "ویرایش پروژه" },
  { action: "projectDelete", label: "حذف پروژه" },
  { action: "taskCreate", label: "ایجاد تسک" },
  { action: "taskUpdate", label: "ویرایش تسک" },
  { action: "taskDelete", label: "حذف تسک" },
  { action: "taskChangeStatus", label: "تغییر وضعیت تسک" },
  { action: "teamCreate", label: "ایجاد عضو" },
  { action: "teamUpdate", label: "ویرایش عضو" },
  { action: "teamDelete", label: "حذف عضو" },
] as const;
const POLICY_ENTITY_ITEMS = [
  { key: "project", label: "پروژه" },
  { key: "task", label: "تسک" },
  { key: "teamMember", label: "عضو تیم" },
] as const;
const POLICY_OPERATION_ITEMS = [
  { key: "view", label: "مشاهده" },
  { key: "create", label: "ایجاد" },
  { key: "update", label: "ویرایش" },
  { key: "delete", label: "حذف" },
  { key: "approve", label: "تایید" },
] as const;
const ACCESS_SCOPE_ITEMS = [
  { value: "none", label: "ندارد" },
  { value: "self", label: "فقط خود" },
  { value: "owner", label: "مالک" },
  { value: "assigned", label: "مسئول" },
  { value: "project", label: "اعضای پروژه" },
  { value: "team", label: "اعضای تیم" },
  { value: "all", label: "همه" },
];

type TeamMemberEditDialogProps = {
  memberEditOpen: boolean;
  initialStep?: "basic" | "profile" | "advanced";
  setMemberEditOpen: (open: boolean) => void;
  setEditingMemberId: (value: string | null) => void;
  memberEditDraft: any;
  setMemberEditDraft: (updater: (prev: any) => any) => void;
  memberEditErrors: Record<string, string>;
  memberInitials: (fullName: string) => string;
  pickAvatarForDraft: (file: File | undefined, mode: "add" | "edit") => Promise<void>;
  updateMember: () => void;
  teams: Array<{ id: string; name: string }>;
  moduleAccessOptions: Array<{ key: string; label: string }>;
  accessPresets: Array<{
    id: string;
    name: string;
    moduleAccess: Record<string, boolean>;
    permissionOverrides: Record<string, boolean>;
    policyOverrides: Record<string, Record<string, string>>;
  }>;
  saveMemberAccessPreset: (payload: {
    name: string;
    moduleAccess: Record<string, boolean>;
    permissionOverrides: Record<string, boolean>;
    policyOverrides: Record<string, Record<string, string>>;
  }) => Promise<void>;
};

export default function TeamMemberEditDialog({
  memberEditOpen,
  initialStep = "basic",
  setMemberEditOpen,
  setEditingMemberId,
  memberEditDraft,
  setMemberEditDraft,
  memberEditErrors,
  memberInitials,
  pickAvatarForDraft,
  updateMember,
  teams,
  moduleAccessOptions,
  accessPresets,
  saveMemberAccessPreset,
}: TeamMemberEditDialogProps) {
  const [step, setStep] = useState<"basic" | "profile" | "advanced">("basic");
  const availablePresets = [
    {
      id: "full",
      name: "دسترسی کامل",
      moduleAccess: moduleAccessDefaults("admin"),
      permissionOverrides: permissionOverridesDefaults("admin"),
      policyOverrides: policyOverridesDefaults("admin"),
    },
    {
      id: "project",
      name: "مدیر پروژه",
      moduleAccess: {
        tasks: true, projects: true, minutes: true, accounting: false, calendar: true, chat: true, notifications: true, team: false, audit: false, reports: true,
      },
      permissionOverrides: permissionOverridesDefaults("manager"),
      policyOverrides: policyOverridesDefaults("manager"),
    },
    {
      id: "finance",
      name: "مالی",
      moduleAccess: {
        tasks: false, projects: false, minutes: false, accounting: true, calendar: true, chat: true, notifications: true, team: false, audit: false, reports: true,
      },
      permissionOverrides: {
        projectCreate: false, projectUpdate: false, projectDelete: false,
        taskCreate: false, taskUpdate: false, taskDelete: false, taskChangeStatus: false,
        teamCreate: false, teamUpdate: false, teamDelete: false,
      },
      policyOverrides: {
        project: { view: "none", create: "none", update: "none", delete: "none", approve: "none" },
        task: { view: "none", create: "none", update: "none", delete: "none", approve: "none" },
        teamMember: { view: "team", create: "none", update: "none", delete: "none", approve: "none" },
      },
    },
    {
      id: "hr",
      name: "منابع انسانی",
      moduleAccess: {
        tasks: false, projects: false, minutes: true, accounting: false, calendar: true, chat: true, notifications: true, team: true, audit: false, reports: true,
      },
      permissionOverrides: {
        projectCreate: false, projectUpdate: false, projectDelete: false,
        taskCreate: false, taskUpdate: false, taskDelete: false, taskChangeStatus: false,
        teamCreate: true, teamUpdate: true, teamDelete: false,
      },
      policyOverrides: {
        project: { view: "none", create: "none", update: "none", delete: "none", approve: "none" },
        task: { view: "none", create: "none", update: "none", delete: "none", approve: "none" },
        teamMember: { view: "team", create: "team", update: "team", delete: "none", approve: "none" },
      },
    },
    ...accessPresets,
  ];
  useEffect(() => {
    if (memberEditOpen) setStep(initialStep);
  }, [memberEditOpen, initialStep]);
  return (
    <Dialog
      open={memberEditOpen}
      onOpenChange={(open) => {
        setMemberEditOpen(open);
        if (!open) setEditingMemberId(null);
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className={`liquid-glass max-h-[90vh] overflow-hidden ${initialStep === "advanced" ? "sm:max-w-6xl" : "sm:max-w-4xl"}`}
      >
        <DialogHeader>
          <DialogTitle>ویرایش پروفایل عضو</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="app-wizard-steps sm:grid-cols-3">
            <Button type="button" variant="ghost" data-active={step === "basic"} className="app-wizard-step" onClick={() => setStep("basic")}>۱. اطلاعات اصلی</Button>
            <Button type="button" variant="ghost" data-active={step === "profile"} className="app-wizard-step" onClick={() => setStep("profile")}>۲. معرفی و ارتباط</Button>
            <Button type="button" variant="ghost" data-active={step === "advanced"} className="app-wizard-step" onClick={() => setStep("advanced")}>۳. تنظیمات تکمیلی</Button>
          </div>
          <div className="dialog-form-grid">
            <div className={step === "advanced" ? "dialog-form-main lg:col-span-2" : "dialog-form-main"}>
            <div className="dialog-form-stack">
              {step === "basic" ? <div className="space-y-2">
                <p className="text-xs text-muted-foreground">اطلاعات اصلی</p>
                <div className="flex items-center gap-3">
                  {memberEditDraft.avatarDataUrl ? (
                    <img src={resolveAssetUrl(memberEditDraft.avatarDataUrl)} alt="avatar" className="h-14 w-14 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                      {memberInitials(memberEditDraft.fullName)}
                    </div>
                  )}
                  <Input type="file" accept="image/*" onChange={(e) => void pickAvatarForDraft(e.target.files?.[0], "edit")} />
                </div>
                <BufferedInput
                  placeholder="نام و نام خانوادگی"
                  value={memberEditDraft.fullName}
                  onCommit={(next) => setMemberEditDraft((p) => ({ ...p, fullName: next }))}
                />
                {memberEditErrors.fullName && <p className="text-xs text-destructive">{memberEditErrors.fullName}</p>}
                <BufferedInput
                  placeholder="شماره تماس"
                  value={memberEditDraft.phone}
                  onCommit={(next) => setMemberEditDraft((p) => ({ ...p, phone: next }))}
                />
                {memberEditErrors.phone && <p className="text-xs text-destructive">{memberEditErrors.phone}</p>}
              </div> : null}
              {step === "profile" ? <div className="space-y-2">
                <p className="text-xs text-muted-foreground">ارتباط و معرفی</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <BufferedInput
                    placeholder="سمت"
                    value={memberEditDraft.role}
                    onCommit={(next) => setMemberEditDraft((p) => ({ ...p, role: next }))}
                  />
                  <BufferedInput
                    placeholder="ایمیل"
                    value={memberEditDraft.email}
                    onCommit={(next) => setMemberEditDraft((p) => ({ ...p, email: next }))}
                  />
                </div>
                <BufferedTextarea
                  className="min-h-28"
                  placeholder="بیو"
                  value={memberEditDraft.bio}
                  onCommit={(next) => setMemberEditDraft((p) => ({ ...p, bio: next }))}
                />
              </div> : null}
            </div>
            </div>
            <div className={step === "advanced" ? "dialog-form-side lg:col-span-1" : "dialog-form-side"}>
            <div className="dialog-form-stack">
              {step === "advanced" ? <details className="rounded-xl border border-border/16 bg-background/70" open>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold marker:hidden">
                  <span>تنظیمات تکمیلی</span>
                  <span className="text-[11px] font-normal text-muted-foreground">دسترسی، تیم‌ها و رمز عبور</span>
                </summary>
                <div className="space-y-3 border-t border-border/10 px-4 py-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <NativeSelect
                      value={memberEditDraft.appRole ?? "member"}
                      onChange={(e) => {
                        const nextRole = e.target.value as "admin" | "manager" | "member";
                        setMemberEditDraft((p) => ({
                          ...p,
                          appRole: nextRole,
                          moduleAccess: moduleAccessDefaults(nextRole),
                          permissionOverrides: permissionOverridesDefaults(nextRole),
                          policyOverrides: policyOverridesDefaults(nextRole),
                        }));
                      }}
                      options={[
                        { value: "admin", label: "ادمین" },
                        { value: "manager", label: "مدیر" },
                        { value: "member", label: "عضو" },
                      ]}
                      aria-label="نقش دسترسی"
                    />
                    <NativeSelect
                      value={memberEditDraft.isActive ? "active" : "inactive"}
                      onChange={(e) => setMemberEditDraft((p) => ({ ...p, isActive: e.target.value === "active" }))}
                      options={[
                        { value: "active", label: "فعال" },
                        { value: "inactive", label: "غیرفعال" },
                      ]}
                      aria-label="وضعیت"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">عضویت در تیم‌ها</p>
                    {teams.map((team) => (
                      <label key={team.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={(memberEditDraft.teamIds ?? []).includes(team.id)}
                          onCheckedChange={() =>
                            setMemberEditDraft((prev) => {
                              const ids = prev.teamIds ?? [];
                              return {
                                ...prev,
                                teamIds: ids.includes(team.id) ? ids.filter((id: string) => id !== team.id) : [...ids, team.id],
                              };
                            })
                          }
                        />
                        <span>{team.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">قالب‌های آماده دسترسی</p>
                    <div className="flex flex-wrap gap-2">
                      {availablePresets.map((preset) => (
                        <Button
                          key={preset.id}
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 rounded-lg border border-border/20 px-3 text-xs"
                          onClick={() =>
                            setMemberEditDraft((prev) => ({
                              ...prev,
                              moduleAccess: preset.moduleAccess,
                              permissionOverrides: preset.permissionOverrides,
                              policyOverrides: preset.policyOverrides,
                            }))
                          }
                        >
                          {preset.name}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-lg border border-border/20 px-3 text-xs"
                        onClick={() => {
                          const name = window.prompt("نام قالب دسترسی را وارد کن");
                          if (!name) return;
                          void saveMemberAccessPreset({
                            name,
                            moduleAccess: memberEditDraft.moduleAccess ?? moduleAccessDefaults(memberEditDraft.appRole ?? "member"),
                            permissionOverrides: memberEditDraft.permissionOverrides ?? permissionOverridesDefaults(memberEditDraft.appRole ?? "member"),
                            policyOverrides: memberEditDraft.policyOverrides ?? policyOverridesDefaults(memberEditDraft.appRole ?? "member"),
                          });
                        }}
                      >
                        ذخیره قالب جدید
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">دسترسی به ماژول‌ها</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {moduleAccessOptions.map((item) => (
                        <label key={item.key} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={memberEditDraft.moduleAccess?.[item.key] === true}
                            onCheckedChange={(checked) =>
                              setMemberEditDraft((prev) => ({
                                ...prev,
                                moduleAccess: {
                                  ...(prev.moduleAccess ?? {}),
                                  [item.key]: checked === true,
                                },
                              }))
                            }
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">دسترسی عملیاتی</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {PERMISSION_ITEMS.map((item) => (
                        <label key={item.action} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={memberEditDraft.permissionOverrides?.[item.action] === true}
                            onCheckedChange={(checked) =>
                              setMemberEditDraft((prev) => ({
                                ...prev,
                                permissionOverrides: {
                                  ...(prev.permissionOverrides ?? {}),
                                  [item.action]: checked === true,
                                },
                              }))
                            }
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">دامنه دسترسی شخصی</p>
                    {POLICY_ENTITY_ITEMS.map((entity) => (
                      <div key={entity.key} className="space-y-2 rounded-lg bg-muted/30 p-3">
                        <p className="text-xs font-medium">{entity.label}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {POLICY_OPERATION_ITEMS.map((operation) => (
                            <NativeSelect
                              key={`${entity.key}-${operation.key}`}
                              value={memberEditDraft.policyOverrides?.[entity.key]?.[operation.key] ?? "none"}
                              onChange={(e) =>
                                setMemberEditDraft((prev) => ({
                                  ...prev,
                                  policyOverrides: {
                                    ...(prev.policyOverrides ?? {}),
                                    [entity.key]: {
                                      ...(prev.policyOverrides?.[entity.key] ?? {}),
                                      [operation.key]: e.target.value,
                                    },
                                  },
                                }))
                              }
                              options={ACCESS_SCOPE_ITEMS.map((scope) => ({
                                value: scope.value,
                                label: `${operation.label}: ${scope.label}`,
                              }))}
                              aria-label={`${entity.label} - ${operation.label}`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <BufferedInput
                    type="password"
                    placeholder="رمز جدید (اختیاری)"
                    value={memberEditDraft.password}
                    onCommit={(next) => setMemberEditDraft((p) => ({ ...p, password: next }))}
                  />
                  {memberEditErrors.password && <p className="text-xs text-destructive">{memberEditErrors.password}</p>}
                </div>
              </details> : <div className="app-wizard-note">در مرحله آخر، دسترسی، تیم‌ها و رمز عبور این عضو را تنظیم می‌کنی.</div>}
            </div>
          </div>
        </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setMemberEditOpen(false)}>
            بستن
          </Button>
          {step !== "basic" ? <Button type="button" variant="ghost" onClick={() => setStep(step === "advanced" ? "profile" : "basic")}>مرحله قبل</Button> : null}
          {step !== "advanced" ? <Button type="button" onClick={() => setStep(step === "basic" ? "profile" : "advanced")}>مرحله بعد</Button> : null}
          {step === "advanced" ? <Button onClick={updateMember}>ذخیره تغییرات</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
