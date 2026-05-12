import { Suspense, useEffect, useState, type ComponentType, type Dispatch, type ReactNode, type RefObject, type SetStateAction, type UIEventHandler } from "react";
import { FolderKanban, FileText, Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { BufferedInput, BufferedTextarea } from "@/components/ui/buffered-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WorkflowStepEditorRow } from "@/components/app/workflow-step-editor";

type ViewKey = "inbox" | "dashboard" | "tasks" | "projects" | "minutes" | "accounting" | "calendar" | "chat" | "notifications" | "team" | "audit" | "reports" | "settings";

type TeamMemberOption = {
  id: string;
  fullName: string;
};

type WorkflowTemplate = {
  id: string;
  label: string;
};

type ProjectDraft = {
  name: string;
  description: string;
  ownerId: string;
  memberIds: string[];
  workflowTemplateText: string;
};

type ProjectRecord = {
  id: string;
  name: string;
  description: string;
  ownerId?: string;
  memberIds?: string[];
  workflowTemplateSteps?: WorkflowStepEditorRow[];
  createdAt: string;
};

type VirtualizedListHandle = {
  ref: RefObject<HTMLDivElement | null>;
  onScroll: UIEventHandler<HTMLDivElement>;
};

type ContextMenuItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  tone?: "danger";
  onSelect: () => void;
};

type WorkflowStepConfigDialogProps = {
  title: string;
  rows: WorkflowStepEditorRow[];
  summary: string;
  onSave: (rows: WorkflowStepEditorRow[]) => void;
  members: TeamMemberOption[];
};

type ProjectsViewProps = {
  shellSidebarCollapsed?: boolean;
  projectOpen: boolean;
  setProjectOpen: Dispatch<SetStateAction<boolean>>;
  projectDraft: ProjectDraft;
  setProjectDraft: Dispatch<SetStateAction<ProjectDraft>>;
  projectErrors: Record<string, string>;
  activeTeamMembers: TeamMemberOption[];
  PROJECT_CHECKLIST_TEMPLATES: WorkflowTemplate[];
  applyProjectChecklistTemplate: (templateId: string, mode: "add" | "edit") => void;
  LazyWorkflowStepConfigDialog: ComponentType<WorkflowStepConfigDialogProps>;
  parseWorkflowStepsText: (value: string) => WorkflowStepEditorRow[];
  toFaNum: (value: string) => string;
  workflowStepsToDraftText: (rows: WorkflowStepEditorRow[]) => string;
  toggleProjectMember: (setter: Dispatch<SetStateAction<ProjectDraft>>, memberId: string) => void;
  addProject: () => void;
  projectSearch: string;
  setProjectSearch: Dispatch<SetStateAction<string>>;
  filteredProjects: ProjectRecord[];
  projectsVirtual: VirtualizedListHandle;
  visibleProjectsRows: ProjectRecord[];
  openContextMenu: (event: React.MouseEvent<HTMLElement>, title: string, items: ContextMenuItem[]) => void;
  openEditProject: (project: ProjectRecord) => void;
  setTaskProjectFilter: Dispatch<SetStateAction<string>>;
  setActiveView: (view: ViewKey) => void;
  copyTextToClipboard: (text: string, message?: string) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  teamMemberNameById: Map<string, string>;
  isoDateTimeToJalali: (iso: string) => string;
  workflowStepsToSummaryText: (rows: WorkflowStepEditorRow[]) => string;
  projectEditOpen: boolean;
  setProjectEditOpen: Dispatch<SetStateAction<boolean>>;
  setEditingProjectId: Dispatch<SetStateAction<string | null>>;
  projectEditDraft: ProjectDraft;
  setProjectEditDraft: Dispatch<SetStateAction<ProjectDraft>>;
  projectEditErrors: Record<string, string>;
  updateProject: () => void;
};

function ProjectSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={["rounded-xl border border-border/16 bg-background p-4 md:p-5", className].filter(Boolean).join(" ")}>
      <div className="mb-4">
        <p className="text-sm font-semibold">{title}</p>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ProjectDisclosureSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <details className="rounded-xl border border-border/16 bg-background/70">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold marker:hidden">
        <span>{title}</span>
        <span className="text-[11px] font-normal text-muted-foreground">{description || "برای باز کردن بزن"}</span>
      </summary>
      <div className="border-t border-border/10 px-4 py-3">{children}</div>
    </details>
  );
}

export default function ProjectsView({
  shellSidebarCollapsed = false,
  projectOpen,
  setProjectOpen,
  projectDraft,
  setProjectDraft,
  projectErrors,
  activeTeamMembers,
  PROJECT_CHECKLIST_TEMPLATES,
  applyProjectChecklistTemplate,
  LazyWorkflowStepConfigDialog,
  parseWorkflowStepsText,
  toFaNum,
  workflowStepsToDraftText,
  toggleProjectMember,
  addProject,
  projectSearch,
  setProjectSearch,
  filteredProjects,
  projectsVirtual,
  visibleProjectsRows,
  openContextMenu,
  openEditProject,
  setTaskProjectFilter,
  setActiveView,
  copyTextToClipboard,
  removeProject,
  teamMemberNameById,
  isoDateTimeToJalali,
  workflowStepsToSummaryText,
  projectEditOpen,
  setProjectEditOpen,
  setEditingProjectId,
  projectEditDraft,
  setProjectEditDraft,
  projectEditErrors,
  updateProject,
}: ProjectsViewProps) {
  const [projectCreateStep, setProjectCreateStep] = useState<"basic" | "members" | "advanced">("basic");
  const [projectEditStep, setProjectEditStep] = useState<"basic" | "members" | "advanced">("basic");
  useEffect(() => {
    if (projectOpen) setProjectCreateStep("basic");
  }, [projectOpen]);
  useEffect(() => {
    if (projectEditOpen) setProjectEditStep("basic");
  }, [projectEditOpen]);
  const renderProjectMenu = (project: ProjectRecord): ContextMenuItem[] => [
    { id: "project-edit", label: "ویرایش پروژه", icon: Pencil, onSelect: () => openEditProject(project) },
    {
      id: "project-filter-tasks",
      label: "نمایش تسک‌های این پروژه",
      icon: FolderKanban,
      onSelect: () => {
        setTaskProjectFilter(project.name);
        setActiveView("tasks");
      },
    },
    {
      id: "project-copy-name",
      label: "کپی نام پروژه",
      icon: FileText,
      onSelect: () => {
        void copyTextToClipboard(project.name, "نام پروژه کپی شد.");
      },
    },
    {
      id: "project-delete",
      label: "حذف پروژه",
      icon: Trash2,
      tone: "danger",
      onSelect: () => {
        void removeProject(project.id);
      },
    },
  ];

  return (
    <>
      <Card className="oneui-project-shell">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="oneui-section-title">پروژه‌ها</CardTitle>
              <CardDescription className="oneui-section-subtitle mt-1">پروژه‌ها را اینجا نگه دار و فقط اعضا و مسیر اجرای اصلی را مشخص کن.</CardDescription>
            </div>
            <div className="oneui-toolbar-scroll flex gap-2 overflow-x-auto pb-1">
              <Button className="h-10 shrink-0 gap-2 rounded-xl" onClick={() => setProjectOpen(true)}>
                <Plus className="h-4 w-4" />
                افزودن پروژه
              </Button>
            </div>
          </div>
          <div className="oneui-project-toolbar rounded-xl border border-border/16 p-3 md:p-4">
            <Input placeholder="جستجو در پروژه‌ها (نام/شرح)" value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} />
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span>کل پروژه‌ها: <span className="font-semibold text-foreground">{toFaNum(String(filteredProjects.length))}</span></span>
              <span>اعضای فعال: <span className="font-semibold text-foreground">{toFaNum(String(activeTeamMembers.length))}</span></span>
            </div>
          </div>
          <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
            <DialogContent aria-describedby={undefined} className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>پروژه جدید</DialogTitle>
              </DialogHeader>
              <div className="app-wizard-steps sm:grid-cols-3">
                <Button type="button" variant="ghost" data-active={projectCreateStep === "basic"} className="app-wizard-step" onClick={() => setProjectCreateStep("basic")}>۱. اطلاعات پایه</Button>
                <Button type="button" variant="ghost" data-active={projectCreateStep === "members"} className="app-wizard-step" onClick={() => setProjectCreateStep("members")}>۲. اعضای پروژه</Button>
                <Button type="button" variant="ghost" data-active={projectCreateStep === "advanced"} className="app-wizard-step" onClick={() => setProjectCreateStep("advanced")}>۳. تنظیمات تکمیلی</Button>
              </div>
              <div className="dialog-form-grid">
                <div className="dialog-form-main dialog-form-stack">
                  {projectCreateStep === "basic" ? <ProjectSection title="اطلاعات پایه" description="نام، مالک و شرح پروژه را ثبت کن." className="oneui-project-section">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-muted-foreground">نام پروژه</p>
                      <BufferedInput placeholder="نام پروژه" value={projectDraft.name} onCommit={(next) => setProjectDraft((p) => ({ ...p, name: next }))} />
                      {projectErrors.name && <p className="text-xs text-destructive">{projectErrors.name}</p>}
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-muted-foreground">مالک پروژه</p>
                      <Select value={projectDraft.ownerId} onValueChange={(value) => setProjectDraft((p) => ({ ...p, ownerId: value, memberIds: Array.from(new Set([value, ...p.memberIds])) }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="مالک پروژه" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeTeamMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {projectErrors.ownerId && <p className="text-xs text-destructive">{projectErrors.ownerId}</p>}
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-muted-foreground">شرح پروژه</p>
                      <BufferedTextarea placeholder="شرح پروژه" value={projectDraft.description} onCommit={(next) => setProjectDraft((p) => ({ ...p, description: next }))} />
                    </div>
                  </div>
                  </ProjectSection> : null}
                </div>

                <div className="dialog-form-side dialog-form-stack">
                  {projectCreateStep === "members" ? <ProjectSection title="اعضای پروژه" description="فقط اعضای اصلی این پروژه را انتخاب کن.">
                  <div className="grid gap-2">
                    {activeTeamMembers.map((member) => (
                      <label key={member.id} className="flex items-center gap-2 rounded-xl bg-muted/14 px-3 py-2 text-sm">
                        <Checkbox checked={projectDraft.memberIds.includes(member.id)} onCheckedChange={() => toggleProjectMember(setProjectDraft, member.id)} />
                        <span>{member.fullName}</span>
                      </label>
                    ))}
                  </div>
                  </ProjectSection> : null}

                  {projectCreateStep === "advanced" ? <ProjectDisclosureSection title="تنظیمات تکمیلی" description="قالب آماده و ورک‌فلو پیش‌فرض پروژه">
                  <ProjectSection title="قالب و ورک‌فلو" description="در صورت نیاز، چک‌لیست و مسیر اجرای پیش‌فرض را تنظیم کن." className="oneui-project-section">
                  <div className="space-y-4">
                    <div className="app-minimal-panel space-y-2 p-3">
                      <p className="text-xs text-muted-foreground">قالب چک‌لیست پروژه</p>
                      <div className="flex flex-wrap gap-2">
                        {PROJECT_CHECKLIST_TEMPLATES.map((template) => (
                          <Button key={template.id} type="button" size="sm" variant="outline" onClick={() => applyProjectChecklistTemplate(template.id, "add")}>
                            {template.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Suspense fallback={null}>
                      <LazyWorkflowStepConfigDialog
                        title="ورکفلو پیش‌فرض پروژه"
                        rows={parseWorkflowStepsText(projectDraft.workflowTemplateText)}
                        summary={parseWorkflowStepsText(projectDraft.workflowTemplateText).length > 0 ? `${toFaNum(String(parseWorkflowStepsText(projectDraft.workflowTemplateText).length))} مرحله تعریف شده` : "بدون ورک‌فلو"}
                        onSave={(next) => setProjectDraft((p) => ({ ...p, workflowTemplateText: workflowStepsToDraftText(next) }))}
                        members={activeTeamMembers}
                      />
                    </Suspense>
                  </div>
                  </ProjectSection>
                  </ProjectDisclosureSection> : <div className="app-wizard-note">در مرحله آخر، چک‌لیست و ورک‌فلو پیش‌فرض پروژه را تنظیم می‌کنی.</div>}
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setProjectOpen(false)}>
                  بستن
                </Button>
                {projectCreateStep !== "basic" ? <Button type="button" variant="ghost" onClick={() => setProjectCreateStep(projectCreateStep === "advanced" ? "members" : "basic")}>مرحله قبل</Button> : null}
                {projectCreateStep !== "advanced" ? <Button type="button" onClick={() => setProjectCreateStep(projectCreateStep === "basic" ? "members" : "advanced")}>مرحله بعد</Button> : null}
                {projectCreateStep === "advanced" ? <Button disabled={activeTeamMembers.length === 0} onClick={addProject}>
                  ثبت پروژه
                </Button> : null}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="space-y-3">
          {activeTeamMembers.length === 0 && <p className="text-xs text-muted-foreground">ابتدا از بخش اعضای تیم، اعضا را ثبت کن.</p>}
          {filteredProjects.length === 0 ? (
            <div className="app-empty-state p-8 text-center text-sm text-muted-foreground">
              <div className="app-empty-state-mark mx-auto mb-4">
                <FolderKanban className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">هنوز پروژه‌ای ثبت نشده است.</p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">اولین پروژه را بساز تا اعضا، workflow و تسک‌های مرتبط را یکجا مدیریت کنی.</p>
            </div>
          ) : (
            <div ref={projectsVirtual.ref} onScroll={projectsVirtual.onScroll} className="max-h-[68vh] overflow-auto rounded-xl">
              <div className={`grid gap-3 md:grid-cols-2 xl:grid-cols-3 ${shellSidebarCollapsed ? "2xl:grid-cols-4" : ""}`}>
                {visibleProjectsRows.map((project) => (
                  <div
                    key={project.id}
                    className="summary-motion-card relative overflow-hidden rounded-xl border border-border/16 bg-background p-4 shadow-sm transition-all hover:bg-muted/10"
                    onContextMenu={(event) => openContextMenu(event, `پروژه: ${project.name}`, renderProjectMenu(project))}
                  >
                    <div className="absolute inset-x-0 top-0 h-1.5 bg-primary/80" />
                    <div className="flex items-start justify-between gap-3 border-b border-border/10 pb-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold">{project.name}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">مالک: {teamMemberNameById.get(project.ownerId ?? "") ?? "نامشخص"}</p>
                      </div>
                        <Button size="icon" variant="outline" className="app-table-action h-8 w-8 rounded-lg" onClick={(event) => openContextMenu(event, `پروژه: ${project.name}`, renderProjectMenu(project))}>
                        <span className="text-base leading-none">⋯</span>
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2 text-[11px]">
                      <p className="line-clamp-4 min-h-[64px] leading-4 text-muted-foreground">{project.description || "بدون شرح"}</p>
                      <div className="rounded-lg bg-muted/14 px-3 py-2">اعضا: {toFaNum(String(project.memberIds?.length ?? 0))}</div>
                      <div className="rounded-lg bg-muted/14 px-3 py-2">تاریخ ثبت: {isoDateTimeToJalali(project.createdAt)}</div>
                      <div className="rounded-lg bg-muted/14 px-3 py-2">ورک‌فلو: {(project.workflowTemplateSteps ?? []).length > 0 ? workflowStepsToSummaryText(project.workflowTemplateSteps ?? []) : "—"}</div>
                    </div>
                    <div className="mt-3 flex flex-col-reverse gap-2 border-t border-border/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <Button variant="outline" className="h-8 flex-1 text-[11px] sm:flex-none" onClick={() => openEditProject(project)}>
                        ویرایش پروژه
                      </Button>
                      <Button variant="ghost" className="h-8 text-[11px]" onClick={() => { setTaskProjectFilter(project.name); setActiveView("tasks"); }}>
                        تسک‌های این پروژه
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={projectEditOpen}
        onOpenChange={(open) => {
          setProjectEditOpen(open);
          if (!open) setEditingProjectId(null);
        }}
      >
            <DialogContent aria-describedby={undefined} className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>ویرایش پروژه</DialogTitle>
          </DialogHeader>
          <div className="app-wizard-steps sm:grid-cols-3">
            <Button type="button" variant="ghost" data-active={projectEditStep === "basic"} className="app-wizard-step" onClick={() => setProjectEditStep("basic")}>۱. اطلاعات پایه</Button>
            <Button type="button" variant="ghost" data-active={projectEditStep === "members"} className="app-wizard-step" onClick={() => setProjectEditStep("members")}>۲. اعضای پروژه</Button>
            <Button type="button" variant="ghost" data-active={projectEditStep === "advanced"} className="app-wizard-step" onClick={() => setProjectEditStep("advanced")}>۳. تنظیمات تکمیلی</Button>
          </div>
          <div className="dialog-form-grid">
            <div className="dialog-form-main dialog-form-stack">
              {projectEditStep === "basic" ? <ProjectSection title="اطلاعات پایه" description="نام، مالک و شرح پروژه را ویرایش کن.">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground">نام پروژه</p>
                  <BufferedInput placeholder="نام پروژه" value={projectEditDraft.name} onCommit={(next) => setProjectEditDraft((p) => ({ ...p, name: next }))} />
                  {projectEditErrors.name && <p className="text-xs text-destructive">{projectEditErrors.name}</p>}
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground">مالک پروژه</p>
                  <Select value={projectEditDraft.ownerId} onValueChange={(value) => setProjectEditDraft((p) => ({ ...p, ownerId: value, memberIds: Array.from(new Set([value, ...p.memberIds])) }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="مالک پروژه" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeTeamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {projectEditErrors.ownerId && <p className="text-xs text-destructive">{projectEditErrors.ownerId}</p>}
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground">شرح پروژه</p>
                  <BufferedTextarea placeholder="شرح پروژه" value={projectEditDraft.description} onCommit={(next) => setProjectEditDraft((p) => ({ ...p, description: next }))} />
                </div>
              </div>
              </ProjectSection> : null}
            </div>
            <div className="dialog-form-side dialog-form-stack">
              {projectEditStep === "members" ? <ProjectSection title="اعضای پروژه" description="اعضای این پروژه را کم و زیاد کن.">
              <div className="grid gap-2">
                {activeTeamMembers.map((member) => (
                  <label key={member.id} className="flex items-center gap-2 rounded-xl bg-muted/14 px-3 py-2 text-sm">
                    <Checkbox checked={projectEditDraft.memberIds.includes(member.id)} onCheckedChange={() => toggleProjectMember(setProjectEditDraft, member.id)} />
                    <span>{member.fullName}</span>
                  </label>
                ))}
              </div>
              </ProjectSection> : null}

              {projectEditStep === "advanced" ? <ProjectDisclosureSection title="تنظیمات تکمیلی" description="چک‌لیست آماده و ورک‌فلو پیش‌فرض پروژه">
              <ProjectSection title="قالب و ورک‌فلو" description="در صورت نیاز، چک‌لیست و مسیر اجرای پیش‌فرض را مدیریت کن.">
              <div className="space-y-4">
                <div className="app-minimal-panel space-y-2 p-3">
                  <p className="text-xs text-muted-foreground">قالب چک‌لیست پروژه</p>
                  <div className="flex flex-wrap gap-2">
                    {PROJECT_CHECKLIST_TEMPLATES.map((template) => (
                      <Button key={template.id} type="button" size="sm" variant="outline" onClick={() => applyProjectChecklistTemplate(template.id, "edit")}>
                        {template.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <Suspense fallback={null}>
                  <LazyWorkflowStepConfigDialog
                    title="ورکفلو پیش‌فرض پروژه"
                    rows={parseWorkflowStepsText(projectEditDraft.workflowTemplateText)}
                    summary={parseWorkflowStepsText(projectEditDraft.workflowTemplateText).length > 0 ? `${toFaNum(String(parseWorkflowStepsText(projectEditDraft.workflowTemplateText).length))} مرحله تعریف شده` : "بدون ورک‌فلو"}
                    onSave={(next) => setProjectEditDraft((p) => ({ ...p, workflowTemplateText: workflowStepsToDraftText(next) }))}
                    members={activeTeamMembers}
                  />
                </Suspense>
              </div>
              </ProjectSection>
              </ProjectDisclosureSection> : <div className="app-wizard-note">در مرحله آخر، قالب و ورک‌فلو پیش‌فرض پروژه را مدیریت می‌کنی.</div>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setProjectEditOpen(false)}>
              بستن
            </Button>
            {projectEditStep !== "basic" ? <Button type="button" variant="ghost" onClick={() => setProjectEditStep(projectEditStep === "advanced" ? "members" : "basic")}>مرحله قبل</Button> : null}
            {projectEditStep !== "advanced" ? <Button type="button" onClick={() => setProjectEditStep(projectEditStep === "basic" ? "members" : "advanced")}>مرحله بعد</Button> : null}
            {projectEditStep === "advanced" ? <Button disabled={activeTeamMembers.length === 0} onClick={updateProject}>
              ذخیره تغییرات
            </Button> : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
