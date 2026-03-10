import { useState } from "react";

export function useTeamHrUiState({ todayIso }: { todayIso: () => string }) {
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberEditOpen, setMemberEditOpen] = useState(false);
  const [memberProfileOpen, setMemberProfileOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [hrAttendanceMonth, setHrAttendanceMonth] = useState(todayIso().slice(0, 7));

  const [memberDraft, setMemberDraft] = useState({
    fullName: "",
    role: "",
    email: "",
    phone: "",
    bio: "",
    avatarDataUrl: "",
    appRole: "member" as "admin" | "manager" | "member",
    isActive: true,
    teamIds: [] as string[],
    password: "",
  });
  const [memberEditDraft, setMemberEditDraft] = useState({
    fullName: "",
    role: "",
    email: "",
    phone: "",
    bio: "",
    avatarDataUrl: "",
    appRole: "member" as "admin" | "manager" | "member",
    isActive: true,
    teamIds: [] as string[],
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
