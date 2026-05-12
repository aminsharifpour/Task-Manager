import { KeyRound, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";

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

type AccessPreset = {
  id: string;
  name: string;
  moduleAccess: Record<string, boolean>;
  permissionOverrides: Record<string, boolean>;
  policyOverrides: Record<string, Record<string, string>>;
};

type TeamMemberAccessDialogProps = {
  memberAccessOpen: boolean;
  setMemberAccessOpen: (open: boolean) => void;
  selectedMember: any;
  memberEditDraft: any;
  setMemberEditDraft: (updater: (prev: any) => any) => void;
  memberEditErrors: Record<string, string>;
  moduleAccessOptions: Array<{ key: string; label: string }>;
  accessPresets: AccessPreset[];
  saveMemberAccessPreset: (payload: {
    name: string;
    moduleAccess: Record<string, boolean>;
    permissionOverrides: Record<string, boolean>;
    policyOverrides: Record<string, Record<string, string>>;
  }) => Promise<void>;
  updateMemberAccess: () => void;
};

export default function TeamMemberAccessDialog({
  memberAccessOpen,
  setMemberAccessOpen,
  selectedMember,
  memberEditDraft,
  setMemberEditDraft,
  memberEditErrors,
  moduleAccessOptions,
  accessPresets,
  saveMemberAccessPreset,
  updateMemberAccess,
}: TeamMemberAccessDialogProps) {
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

  const activeModulesCount = moduleAccessOptions.filter((item) => memberEditDraft.moduleAccess?.[item.key] !== false).length;

  return (
    <Dialog open={memberAccessOpen} onOpenChange={setMemberAccessOpen}>
      <DialogContent aria-describedby={undefined} className="max-h-[90vh] overflow-hidden bg-card sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>شخصی‌سازی دسترسی عضو</DialogTitle>
          <DialogDescription>
            {selectedMember ? `تنظیم کامل دسترسی‌های ${selectedMember.fullName}` : "تنظیم کامل دسترسی‌های این عضو"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-3 rounded-2xl bg-muted/40 p-4">
            <div className="rounded-2xl bg-background p-4">
              <p className="text-sm font-semibold text-foreground">{selectedMember?.fullName ?? "عضو انتخاب‌شده"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{selectedMember?.role || "بدون سمت"} · {selectedMember?.email || "بدون ایمیل"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{activeModulesCount} ماژول فعال</Badge>
                <Badge variant="outline">{memberEditDraft.appRole === "admin" ? "ادمین" : memberEditDraft.appRole === "manager" ? "مدیر" : "عضو"}</Badge>
              </div>
            </div>
            <div className="rounded-2xl bg-background p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">نقش پایه دسترسی</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">اول نقش پایه را تعیین کن، بعد اگر لازم بود ماژول‌ها و scopeها را دقیق شخصی‌سازی کن.</p>
              <div className="mt-3">
                <NativeSelect
                  value={memberEditDraft.appRole ?? "member"}
                  onChange={(e) => {
                    const nextRole = e.target.value as "admin" | "manager" | "member";
                    setMemberEditDraft((prev) => ({
                      ...prev,
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
                  aria-label="نقش پایه دسترسی"
                />
              </div>
            </div>
            <div className="rounded-2xl bg-background p-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">قالب‌های آماده</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {availablePresets.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-lg bg-muted/40 px-3 text-xs"
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
              </div>
              <Button
                type="button"
                variant="ghost"
                className="mt-3 h-9 w-full rounded-xl border border-border/14 text-sm"
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
          </aside>

          <div className="min-h-0 overflow-y-auto pr-1">
            <div className="space-y-4">
              <section className="rounded-2xl bg-muted/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">دسترسی به ماژول‌ها</p>
                    <p className="text-xs text-muted-foreground">مشخص کن این عضو کدام بخش‌های نرم‌افزار را اصلا ببیند یا نبیند.</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {moduleAccessOptions.map((item) => (
                    <label key={item.key} className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-3 text-sm">
                      <span>{item.label}</span>
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
                    </label>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl bg-muted/30 p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold">دسترسی‌های عملیاتی</p>
                  <p className="text-xs text-muted-foreground">علاوه بر خود ماژول، عملیات‌های مهم را هم به‌صورت جدا کنترل کن.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {PERMISSION_ITEMS.map((item) => (
                    <label key={item.action} className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-3 text-sm">
                      <span>{item.label}</span>
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
                    </label>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl bg-muted/30 p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold">دامنه دسترسی شخصی</p>
                  <p className="text-xs text-muted-foreground">برای هر موجودیت مشخص کن این عضو تا چه scopeای امکان مشاهده، ایجاد، ویرایش، حذف و تایید داشته باشد.</p>
                </div>
                <div className="space-y-3">
                  {POLICY_ENTITY_ITEMS.map((entity) => (
                    <div key={entity.key} className="rounded-2xl bg-background p-4">
                      <p className="mb-3 text-sm font-semibold">{entity.label}</p>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
              </section>
            </div>
          </div>
        </div>
        <DialogFooter>
          {memberEditErrors.fullName ? <p className="ml-auto text-xs text-destructive">{memberEditErrors.fullName}</p> : null}
          <Button variant="secondary" onClick={() => setMemberAccessOpen(false)}>
            بستن
          </Button>
          <Button onClick={updateMemberAccess}>ذخیره دسترسی‌ها</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
