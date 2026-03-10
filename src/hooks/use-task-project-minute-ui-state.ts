import { useState } from "react";

export function useTaskProjectMinuteUiState({ todayIso }: { todayIso: () => string }) {
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskCreateBusy, setTaskCreateBusy] = useState(false);
  const [taskEditOpen, setTaskEditOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectEditOpen, setProjectEditOpen] = useState(false);
  const [minuteEditOpen, setMinuteEditOpen] = useState(false);
  const [minuteDetailOpen, setMinuteDetailOpen] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingMinuteId, setEditingMinuteId] = useState<string | null>(null);
  const [selectedMinuteId, setSelectedMinuteId] = useState<string | null>(null);

  const [projectSearch, setProjectSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskProjectFilter, setTaskProjectFilter] = useState("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState<"all" | string>("all");
  const [minuteSearch, setMinuteSearch] = useState("");
  const [minuteFrom, setMinuteFrom] = useState("");
  const [minuteTo, setMinuteTo] = useState("");

  const [taskDraft, setTaskDraft] = useState({
    title: "",
    description: "",
    assignerId: "",
    assigneePrimaryId: "",
    assigneeSecondaryId: "",
    projectName: "",
    announceDateIso: todayIso(),
    executionDateIso: todayIso(),
    status: "todo",
    blockedReason: "",
    workflowStepsText: "",
  });
  const [projectDraft, setProjectDraft] = useState({ name: "", description: "", ownerId: "", memberIds: [] as string[], workflowTemplateText: "" });
  const [projectEditDraft, setProjectEditDraft] = useState({ name: "", description: "", ownerId: "", memberIds: [] as string[], workflowTemplateText: "" });
  const [minuteDraft, setMinuteDraft] = useState({
    title: "",
    dateIso: todayIso(),
    attendees: "",
    summary: "",
    decisions: "",
    followUps: "",
  });
  const [minuteEditDraft, setMinuteEditDraft] = useState({
    title: "",
    dateIso: todayIso(),
    attendees: "",
    summary: "",
    decisions: "",
    followUps: "",
  });
  const [taskEditDraft, setTaskEditDraft] = useState({
    title: "",
    description: "",
    assignerId: "",
    assigneePrimaryId: "",
    assigneeSecondaryId: "",
    projectName: "",
    announceDateIso: todayIso(),
    executionDateIso: todayIso(),
    status: "todo",
    blockedReason: "",
    workflowStepsText: "",
  });

  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});
  const [taskEditErrors, setTaskEditErrors] = useState<Record<string, string>>({});
  const [projectErrors, setProjectErrors] = useState<Record<string, string>>({});
  const [projectEditErrors, setProjectEditErrors] = useState<Record<string, string>>({});
  const [minuteErrors, setMinuteErrors] = useState<Record<string, string>>({});
  const [minuteEditErrors, setMinuteEditErrors] = useState<Record<string, string>>({});

  return {
    taskOpen,
    setTaskOpen,
    taskCreateBusy,
    setTaskCreateBusy,
    taskEditOpen,
    setTaskEditOpen,
    projectOpen,
    setProjectOpen,
    projectEditOpen,
    setProjectEditOpen,
    minuteEditOpen,
    setMinuteEditOpen,
    minuteDetailOpen,
    setMinuteDetailOpen,
    editingTaskId,
    setEditingTaskId,
    editingProjectId,
    setEditingProjectId,
    editingMinuteId,
    setEditingMinuteId,
    selectedMinuteId,
    setSelectedMinuteId,
    projectSearch,
    setProjectSearch,
    taskSearch,
    setTaskSearch,
    taskProjectFilter,
    setTaskProjectFilter,
    taskStatusFilter,
    setTaskStatusFilter,
    minuteSearch,
    setMinuteSearch,
    minuteFrom,
    setMinuteFrom,
    minuteTo,
    setMinuteTo,
    taskDraft,
    setTaskDraft,
    projectDraft,
    setProjectDraft,
    projectEditDraft,
    setProjectEditDraft,
    minuteDraft,
    setMinuteDraft,
    minuteEditDraft,
    setMinuteEditDraft,
    taskEditDraft,
    setTaskEditDraft,
    taskErrors,
    setTaskErrors,
    taskEditErrors,
    setTaskEditErrors,
    projectErrors,
    setProjectErrors,
    projectEditErrors,
    setProjectEditErrors,
    minuteErrors,
    setMinuteErrors,
    minuteEditErrors,
    setMinuteEditErrors,
  };
}
