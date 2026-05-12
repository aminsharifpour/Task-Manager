import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const MODULE_ACCESS_PRESETS = [
  {
    key: "full",
    label: "دسترسی کامل",
    getValue: () =>
      moduleAccessDefaults("admin"),
  },
  {
    key: "project",
    label: "مدیر پروژه",
    getValue: () => ({
      tasks: true,
      projects: true,
      minutes: true,
      accounting: false,
      calendar: true,
      chat: true,
      notifications: true,
      team: false,
      audit: false,
      reports: true,
    }),
  },
  {
    key: "finance",
    label: "مالی",
    getValue: () => ({
      tasks: false,
      projects: false,
      minutes: false,
      accounting: true,
      calendar: true,
      chat: true,
      notifications: true,
      team: false,
      audit: false,
      reports: true,
    }),
  },
  {
    key: "hr",
    label: "منابع انسانی",
    getValue: () => ({
      tasks: false,
      projects: false,
      minutes: true,
      accounting: false,
      calendar: true,
      chat: true,
      notifications: true,
      team: true,
      audit: false,
      reports: true,
    }),
  },
];

type TeamMemberAddDialogProps = {
  memberOpen: boolean;
  setMemberOpen: (open: boolean) => void;
  memberDraft: any;
  setMemberDraft: (updater: (prev: any) => any) => void;
  memberErrors: Record<string, string>;
  memberInitials: (fullName: string) => string;
  pickAvatarForDraft: (file: File | undefined, mode: "add" | "edit") => Promise<void>;
  addMember: () => void;
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

export default function TeamMemberAddDialog({
  memberOpen,
  setMemberOpen,
  memberDraft,
  setMemberDraft,
  memberErrors,
  memberInitials,
  pickAvatarForDraft,
  addMember,
  teams,
  moduleAccessOptions,
  accessPresets,
  saveMemberAccessPreset,
}: TeamMemberAddDialogProps) {
  const [step, setStep] = useState<"basic" | "profile" | "advanced">("basic");
  const availablePresets = [
    ...MODULE_ACCESS_PRESETS.map((preset) => ({
      id: preset.key,
      name: preset.label,
      moduleAccess: preset.getValue(),
      permissionOverrides: permissionOverridesDefaults("member"),
      policyOverrides: policyOverridesDefaults("member"),
    })),
    ...accessPresets,
  ];
  useEffect(() => {
    if (memberOpen) setStep("basic");
  }, [memberOpen]);
  return (
    <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          افزودن عضو
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="liquid-glass sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>عضو جدید</DialogTitle>
        </DialogHeader>
        <div className="app-wizard-steps sm:grid-cols-3">
          <Button type="button" variant="ghost" data-active={step === "basic"} className="app-wizard-step" onClick={() => setStep("basic")}>۱. اطلاعات اصلی</Button>
          <Button type="button" variant="ghost" data-active={step === "profile"} className="app-wizard-step" onClick={() => setStep("profile")}>۲. معرفی و ارتباط</Button>
          <Button type="button" variant="ghost" data-active={step === "advanced"} className="app-wizard-step" onClick={() => setStep("advanced")}>۳. تنظیمات تکمیلی</Button>
        </div>
        <div className="dialog-form-grid">
          <div className="dialog-form-main">
            <div className="dialog-form-stack">
              {step === "basic" ? <div className="space-y-2">
                <p className="text-xs text-muted-foreground">اطلاعات اصلی</p>
                <div className="flex items-center gap-3">
                  {memberDraft.avatarDataUrl ? (
                    <img src={resolveAssetUrl(memberDraft.avatarDataUrl)} alt="avatar" className="h-14 w-14 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                      {memberInitials(memberDraft.fullName)}
                    </div>
                  )}
                  <Input type="file" accept="image/*" onChange={(e) => void pickAvatarForDraft(e.target.files?.[0], "add")} />
                </div>
                <BufferedInput
                  placeholder="نام و نام خانوادگی"
                  value={memberDraft.fullName}
                  onCommit={(next) => setMemberDraft((p) => ({ ...p, fullName: next }))}
                />
                {memberErrors.fullName && <p className="text-xs text-destructive">{memberErrors.fullName}</p>}
                <BufferedInput
                  placeholder="شماره تماس"
                  value={memberDraft.phone}
                  onCommit={(next) => setMemberDraft((p) => ({ ...p, phone: next }))}
                />
                {memberErrors.phone && <p className="text-xs text-destructive">{memberErrors.phone}</p>}
              </div> : null}
              {step === "profile" ? <div className="space-y-2">
                <p className="text-xs text-muted-foreground">ارتباط و معرفی</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <BufferedInput
                    placeholder="سمت"
                    value={memberDraft.role}
                    onCommit={(next) => setMemberDraft((p) => ({ ...p, role: next }))}
                  />
                  <BufferedInput
                    placeholder="ایمیل"
                    value={memberDraft.email}
                    onCommit={(next) => setMemberDraft((p) => ({ ...p, email: next }))}
                  />
                </div>
                <BufferedTextarea
                  className="min-h-28"
                  placeholder="بیو / توضیح کوتاه"
                  value={memberDraft.bio}
                  onCommit={(next) => setMemberDraft((p) => ({ ...p, bio: next }))}
                />
              </div> : null}
            </div>
          </div>
          <div className="dialog-form-side">
            <div className="dialog-form-stack">
              {step === "advanced" ? <details className="rounded-xl border border-border/16 bg-background/70" open>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold marker:hidden">
                  <span>تنظیمات تکمیلی</span>
                  <span className="text-[11px] font-normal text-muted-foreground">دسترسی، تیم‌ها و رمز عبور</span>
                </summary>
                <div className="space-y-3 border-t border-border/10 px-4 py-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <NativeSelect
                      value={memberDraft.appRole ?? "member"}
                      onChange={(e) => {
                        const nextRole = e.target.value as "admin" | "manager" | "member";
                        setMemberDraft((p) => ({
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
                      value={memberDraft.isActive ? "active" : "inactive"}
                      onChange={(e) => setMemberDraft((p) => ({ ...p, isActive: e.target.value === "active" }))}
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
                          checked={(memberDraft.teamIds ?? []).includes(team.id)}
                          onCheckedChange={() =>
                            setMemberDraft((prev) => {
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
                            setMemberDraft((prev) => ({
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
                            moduleAccess: memberDraft.moduleAccess ?? moduleAccessDefaults(memberDraft.appRole ?? "member"),
                            permissionOverrides: memberDraft.permissionOverrides ?? permissionOverridesDefaults(memberDraft.appRole ?? "member"),
                            policyOverrides: memberDraft.policyOverrides ?? policyOverridesDefaults(memberDraft.appRole ?? "member"),
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
                            checked={memberDraft.moduleAccess?.[item.key] === true}
                            onCheckedChange={(checked) =>
                              setMemberDraft((prev) => ({
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
                            checked={memberDraft.permissionOverrides?.[item.action] === true}
                            onCheckedChange={(checked) =>
                              setMemberDraft((prev) => ({
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
                              value={memberDraft.policyOverrides?.[entity.key]?.[operation.key] ?? "none"}
                              onChange={(e) =>
                                setMemberDraft((prev) => ({
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
                    placeholder="رمز عبور"
                    value={memberDraft.password}
                    onCommit={(next) => setMemberDraft((p) => ({ ...p, password: next }))}
                  />
                  {memberErrors.password && <p className="text-xs text-destructive">{memberErrors.password}</p>}
                </div>
              </details> : <div className="app-wizard-note">در مرحله آخر، نقش دسترسی، تیم‌ها و رمز عبور را تنظیم می‌کنی.</div>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setMemberOpen(false)}>
            بستن
          </Button>
          {step !== "basic" ? <Button type="button" variant="ghost" onClick={() => setStep(step === "advanced" ? "profile" : "basic")}>مرحله قبل</Button> : null}
          {step !== "advanced" ? <Button type="button" onClick={() => setStep(step === "basic" ? "profile" : "advanced")}>مرحله بعد</Button> : null}
          {step === "advanced" ? <Button onClick={addMember}>ایجاد عضو</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
