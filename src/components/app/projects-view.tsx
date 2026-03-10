// @ts-nocheck
import { Suspense } from "react";
import { FolderKanban, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { BufferedInput, BufferedTextarea } from "@/components/ui/buffered-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ProjectsView(props: any) {
  const {
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
  } = props;

  return (
    <>
      <Card className="liquid-glass lift-on-hover">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>پروژه‌ها</CardTitle>
            <CardDescription>برای تسک‌ها پروژه بساز و از آن‌ها گزارش پیشرفت بگیر.</CardDescription>
          </div>
          <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                افزودن پروژه
              </Button>
            </DialogTrigger>
            <DialogContent aria-describedby={undefined} className="liquid-glass">
              <DialogHeader>
                <DialogTitle>پروژه جدید</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <BufferedInput
                  placeholder="نام پروژه"
                  value={projectDraft.name}
                  onCommit={(next) => setProjectDraft((p) => ({ ...p, name: next }))}
                />
                {projectErrors.name && <p className="text-xs text-destructive">{projectErrors.name}</p>}
                <div className="space-y-2">
                  <Select
                    value={projectDraft.ownerId}
                    onValueChange={(v) => setProjectDraft((p) => ({ ...p, ownerId: v, memberIds: Array.from(new Set([v, ...p.memberIds])) }))}
                  >
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
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">قالب چک‌لیست پروژه</p>
                  <div className="flex flex-wrap gap-2">
                    {PROJECT_CHECKLIST_TEMPLATES.map((template) => (
                      <Button
                        key={template.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => applyProjectChecklistTemplate(template.id, "add")}
                      >
                        {template.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <BufferedTextarea
                  placeholder="شرح پروژه"
                  value={projectDraft.description}
                  onCommit={(next) => setProjectDraft((p) => ({ ...p, description: next }))}
                />
                <Suspense fallback={null}>
                  <LazyWorkflowStepConfigDialog
                    title="ورکفلو پیش‌فرض پروژه"
                    rows={parseWorkflowStepsText(projectDraft.workflowTemplateText)}
                    summary={
                      parseWorkflowStepsText(projectDraft.workflowTemplateText).length > 0
                        ? `${toFaNum(String(parseWorkflowStepsText(projectDraft.workflowTemplateText).length))} مرحله تعریف شده`
                        : "بدون ورک‌فلو"
                    }
                    onSave={(next) => setProjectDraft((p) => ({ ...p, workflowTemplateText: workflowStepsToDraftText(next) }))}
                    members={activeTeamMembers}
                  />
                </Suspense>
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">اعضای پروژه</p>
                  <div className="grid gap-2">
                    {activeTeamMembers.map((member) => (
                      <label key={member.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={projectDraft.memberIds.includes(member.id)} onCheckedChange={() => toggleProjectMember(setProjectDraft, member.id)} />
                        <span>{member.fullName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setProjectOpen(false)}>
                  بستن
                </Button>
                <Button disabled={activeTeamMembers.length === 0} onClick={addProject}>
                  ثبت پروژه
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="جستجو در پروژه‌ها (نام/شرح)" value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} />
          {activeTeamMembers.length === 0 && <p className="text-xs text-muted-foreground">ابتدا از بخش اعضای تیم، اعضا را ثبت کن.</p>}
          {filteredProjects.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">هنوز پروژه‌ای ثبت نشده است.</div>
          ) : (
            <div ref={projectsVirtual.ref} onScroll={projectsVirtual.onScroll} className="max-h-[68vh] overflow-auto rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">نام پروژه</th>
                    <th className="px-3 py-2 text-right font-medium">مالک</th>
                    <th className="px-3 py-2 text-right font-medium">تعداد اعضا</th>
                    <th className="px-3 py-2 text-right font-medium">تاریخ ثبت</th>
                    <th className="px-3 py-2 text-right font-medium">ورکفلو پیش‌فرض</th>
                    <th className="px-3 py-2 text-right font-medium">شرح</th>
                    <th className="px-3 py-2 text-right font-medium">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {projectsVirtual.windowState.paddingTop > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={7} style={{ height: projectsVirtual.windowState.paddingTop }} />
                    </tr>
                  )}
                  {visibleProjectsRows.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t"
                      onContextMenu={(event) =>
                        openContextMenu(event, `پروژه: ${p.name}`, [
                          { id: "project-edit", label: "ویرایش پروژه", icon: Pencil, onSelect: () => openEditProject(p) },
                          {
                            id: "project-filter-tasks",
                            label: "نمایش تسک‌های این پروژه",
                            icon: FolderKanban,
                            onSelect: () => {
                              setTaskProjectFilter(p.name);
                              setActiveView("tasks");
                            },
                          },
                          {
                            id: "project-copy-name",
                            label: "کپی نام پروژه",
                            icon: FileText,
                            onSelect: () => {
                              void copyTextToClipboard(p.name, "نام پروژه کپی شد.");
                            },
                          },
                          {
                            id: "project-delete",
                            label: "حذف پروژه",
                            icon: Trash2,
                            tone: "danger",
                            onSelect: () => {
                              void removeProject(p.id);
                            },
                          },
                        ])
                      }
                    >
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2">{teamMemberNameById.get(p.ownerId ?? "") ?? "نامشخص"}</td>
                      <td className="px-3 py-2">{toFaNum(String(p.memberIds?.length ?? 0))}</td>
                      <td className="px-3 py-2">{isoDateTimeToJalali(p.createdAt)}</td>
                      <td className="px-3 py-2">{(p.workflowTemplateSteps ?? []).length > 0 ? workflowStepsToSummaryText(p.workflowTemplateSteps ?? []) : "—"}</td>
                      <td className="max-w-[340px] truncate px-3 py-2 text-muted-foreground">{p.description || "بدون شرح"}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditProject(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeProject(p.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {projectsVirtual.windowState.paddingBottom > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={7} style={{ height: projectsVirtual.windowState.paddingBottom }} />
                    </tr>
                  )}
                </tbody>
              </table>
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
        <DialogContent aria-describedby={undefined} className="liquid-glass">
          <DialogHeader>
            <DialogTitle>ویرایش پروژه</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <BufferedInput
              placeholder="نام پروژه"
              value={projectEditDraft.name}
              onCommit={(next) => setProjectEditDraft((p) => ({ ...p, name: next }))}
            />
            {projectEditErrors.name && <p className="text-xs text-destructive">{projectEditErrors.name}</p>}
            <div className="space-y-2">
              <Select
                value={projectEditDraft.ownerId}
                onValueChange={(v) => setProjectEditDraft((p) => ({ ...p, ownerId: v, memberIds: Array.from(new Set([v, ...p.memberIds])) }))}
              >
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
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">قالب چک‌لیست پروژه</p>
              <div className="flex flex-wrap gap-2">
                {PROJECT_CHECKLIST_TEMPLATES.map((template) => (
                  <Button
                    key={template.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyProjectChecklistTemplate(template.id, "edit")}
                  >
                    {template.label}
                  </Button>
                ))}
              </div>
            </div>
            <BufferedTextarea
              placeholder="شرح پروژه"
              value={projectEditDraft.description}
              onCommit={(next) => setProjectEditDraft((p) => ({ ...p, description: next }))}
            />
            <Suspense fallback={null}>
              <LazyWorkflowStepConfigDialog
                title="ورکفلو پیش‌فرض پروژه"
                rows={parseWorkflowStepsText(projectEditDraft.workflowTemplateText)}
                summary={
                  parseWorkflowStepsText(projectEditDraft.workflowTemplateText).length > 0
                    ? `${toFaNum(String(parseWorkflowStepsText(projectEditDraft.workflowTemplateText).length))} مرحله تعریف شده`
                    : "بدون ورک‌فلو"
                }
                onSave={(next) => setProjectEditDraft((p) => ({ ...p, workflowTemplateText: workflowStepsToDraftText(next) }))}
                members={activeTeamMembers}
              />
            </Suspense>
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">اعضای پروژه</p>
              <div className="grid gap-2">
                {activeTeamMembers.map((member) => (
                  <label key={member.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={projectEditDraft.memberIds.includes(member.id)} onCheckedChange={() => toggleProjectMember(setProjectEditDraft, member.id)} />
                    <span>{member.fullName}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setProjectEditOpen(false)}>
              بستن
            </Button>
            <Button disabled={activeTeamMembers.length === 0} onClick={updateProject}>
              ذخیره تغییرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
