export type FieldDefinition = { id: string; label: string; type: string; required: boolean; options?: string[] };
export type WorkflowStep = {
  id: string; title: string; requiresApproval?: boolean;
  assigneeType?: string; assigneeMemberId?: string; assigneeRole?: string;
  approvalAssigneeType?: string; approvalAssigneeMemberId?: string; approvalAssigneeRole?: string;
  dueDate?: string; approvalDeadline?: string; onApprove?: string; onReject?: string;
};
export type TaskRecord = {
  id: string; title: string; description: string | null; priority: string; status: string;
  version: number; projectId: string | null;
  project: { id: string; name?: string; customFieldDefinitions?: FieldDefinition[] | null } | null;
  assignerId: string; assigneePrimaryId: string; assigneeSecondaryId: string | null;
  startDate: string | null; announceDate?: string | null; executionDate: string | null;
  estimateMinutes: number | null; customFields: Record<string, string> | null;
  parentTaskId: string | null; blockedReason?: string | null; isDone?: boolean;
  workflowSteps: WorkflowStep[] | null; workflowCurrentStep: number;
  workflowPendingAssigneeIds: string[] | null; workflowCompletedAt: string | null;
  lastStatusChangedAt?: string | null; createdAt?: string; updatedAt?: string;
};
export type TaskDetail = {
  task: TaskRecord; canEdit: boolean;
  people?: { id: string; fullName: string }[];
  parent?: { id: string; title: string; status: string } | null;
  checklist: { id: string; text: string; isDone: boolean }[];
  dependencies: { dependsOn: { id: string; title: string; status: string } }[];
};
export type TaskComment = {
  id: string; text: string; stepId: string; createdAt: string; authorId?: string;
  author?: { fullName: string | null };
};
export type TaskTime = {
  id: string; userId: string; spentMinutes: number; workDate: string;
  version: number; note: string | null; member?: { user: { fullName: string } };
};
export const taskStatuses: Record<string, string> = {
  todo: "انجام‌نشده", doing: "در حال انجام", blocked: "متوقف", done: "انجام‌شده",
};
export const taskPriorities: Record<string, string> = {
  low: "کم", normal: "عادی", high: "زیاد", urgent: "فوری",
};
export function taskPerson(detail: TaskDetail, id?: string | null) {
  if (!id) return "تعیین نشده";
  return detail.people?.find(person => person.id === id)?.fullName || "عضو ثبت‌شده (" + id + ")";
}
