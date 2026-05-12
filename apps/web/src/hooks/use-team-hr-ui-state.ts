import { useState } from "react";

type MemberDraftState = {
  fullName: string;
  role: string;
  email: string;
  phone: string;
  bio: string;
  avatarDataUrl: string;
  appRole: "admin" | "manager" | "member";
  isActive: boolean;
  teamIds: string[];
  moduleAccess: Record<string, boolean>;
  permissionOverrides: Record<string, boolean>;
  policyOverrides: Record<string, Record<string, string>>;
  password: string;
};

export function useTeamHrUiState({ todayIso }: { todayIso: () => string }) {
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
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberEditOpen, setMemberEditOpen] = useState(false);
  const [memberAccessOpen, setMemberAccessOpen] = useState(false);
  const [memberEditInitialStep, setMemberEditInitialStep] = useState<"basic" | "profile" | "advanced">("basic");
  const [memberProfileOpen, setMemberProfileOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [hrAttendanceMonth, setHrAttendanceMonth] = useState(todayIso().slice(0, 7));

  const [memberDraft, setMemberDraft] = useState<MemberDraftState>({
    fullName: "",
    role: "",
    email: "",
    phone: "",
    bio: "",
    avatarDataUrl: "",
    appRole: "member" as "admin" | "manager" | "member",
    isActive: true,
    teamIds: [] as string[],
    moduleAccess: moduleAccessDefaults("member"),
    permissionOverrides: permissionOverridesDefaults("member"),
    policyOverrides: policyOverridesDefaults("member"),
    password: "",
  });
  const [memberEditDraft, setMemberEditDraft] = useState<MemberDraftState>({
    fullName: "",
    role: "",
    email: "",
    phone: "",
    bio: "",
    avatarDataUrl: "",
    appRole: "member" as "admin" | "manager" | "member",
    isActive: true,
    teamIds: [] as string[],
    moduleAccess: moduleAccessDefaults("member"),
    permissionOverrides: permissionOverridesDefaults("member"),
    policyOverrides: policyOverridesDefaults("member"),
    password: "",
  });
  const [teamDraft, setTeamDraft] = useState({ name: "", description: "" });
  const [hrProfileDraft, setHrProfileDraft] = useState({
    employeeCode: "",
    department: "",
    managerId: "",
    hireDate: "",
    birthDate: "",
    nationalId: "",
    contractType: "full-time",
    salaryBase: "",
    education: "",
    skills: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    notes: "",
  });
  const [hrLeaveDraft, setHrLeaveDraft] = useState({
    memberId: "",
    leaveType: "annual",
    fromDate: todayIso(),
    toDate: todayIso(),
    hours: "",
    reason: "",
  });
  const [hrAttendanceDraft, setHrAttendanceDraft] = useState({
    memberId: "",
    date: todayIso(),
    checkIn: "09:00",
    checkOut: "17:00",
    workHours: "8",
    status: "present",
    note: "",
  });

  const [memberErrors, setMemberErrors] = useState<Record<string, string>>({});
  const [memberEditErrors, setMemberEditErrors] = useState<Record<string, string>>({});
  const [hrProfileErrors, setHrProfileErrors] = useState<Record<string, string>>({});
  const [hrLeaveErrors, setHrLeaveErrors] = useState<Record<string, string>>({});
  const [hrAttendanceErrors, setHrAttendanceErrors] = useState<Record<string, string>>({});

  return {
    memberOpen,
    setMemberOpen,
    memberEditOpen,
    setMemberEditOpen,
    memberAccessOpen,
    setMemberAccessOpen,
    memberEditInitialStep,
    setMemberEditInitialStep,
    memberProfileOpen,
    setMemberProfileOpen,
    editingMemberId,
    setEditingMemberId,
    selectedMemberId,
    setSelectedMemberId,
    memberSearch,
    setMemberSearch,
    hrAttendanceMonth,
    setHrAttendanceMonth,
    memberDraft,
    setMemberDraft,
    memberEditDraft,
    setMemberEditDraft,
    teamDraft,
    setTeamDraft,
    hrProfileDraft,
    setHrProfileDraft,
    hrLeaveDraft,
    setHrLeaveDraft,
    hrAttendanceDraft,
    setHrAttendanceDraft,
    memberErrors,
    setMemberErrors,
    memberEditErrors,
    setMemberEditErrors,
    hrProfileErrors,
    setHrProfileErrors,
    hrLeaveErrors,
    setHrLeaveErrors,
    hrAttendanceErrors,
    setHrAttendanceErrors,
  };
}
