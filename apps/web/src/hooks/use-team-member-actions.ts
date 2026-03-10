import type { Dispatch, SetStateAction } from "react";
import { normalizeUiMessage } from "@/lib/api-client";

type Args = {
  apiRequest: <T>(path: string, init?: RequestInit) => Promise<T>;
  pushToast: (message: string, tone?: "success" | "error") => void;
  canPerform: (action: any, targetMemberId?: string) => boolean;
  confirmAction: (message: string, options?: any) => Promise<boolean>;
  settingsDraft: any;
  activeTeams: any[];
  teams: any[];
  teamMembers: any[];
  teamMemberNameById: Map<string, string>;
  memberDraft: any;
  setMemberDraft: Dispatch<SetStateAction<any>>;
  memberEditDraft: any;
  setMemberEditDraft: Dispatch<SetStateAction<any>>;
  teamDraft: any;
  setTeamDraft: Dispatch<SetStateAction<any>>;
  editingMemberId: string | null;
  setEditingMemberId: (id: string | null) => void;
  setEditingTeamId?: (id: string | null) => void;
  setSelectedMemberId: Dispatch<SetStateAction<string | null>>;
  setMemberErrors: (errors: Record<string, string>) => void;
  setMemberEditErrors: (errors: Record<string, string>) => void;
  setTeamMembers: Dispatch<SetStateAction<any[]>>;
  setTeams: Dispatch<SetStateAction<any[]>>;
  setTasks: Dispatch<SetStateAction<any[]>>;
  setMemberOpen: (open: boolean) => void;
  setMemberEditOpen: (open: boolean) => void;
};

export const useTeamMemberActions = ({
  apiRequest,
  pushToast,
  canPerform,
  confirmAction,
  settingsDraft,
  activeTeams,
  teams,
  teamMembers,
  teamMemberNameById,
  memberDraft,
  setMemberDraft,
  memberEditDraft,
  setMemberEditDraft,
  teamDraft,
  setTeamDraft,
  editingMemberId,
  setEditingMemberId,
  setSelectedMemberId,
  setMemberErrors,
  setMemberEditErrors,
  setTeamMembers,
  setTeams,
  setTasks,
  setMemberOpen,
  setMemberEditOpen,
}: Args) => {
  const addTeamGroup = async () => {
    const name = teamDraft.name.trim();
    if (name.length < 2) {
      pushToast("نام تیم باید حداقل ۲ کاراکتر باشد.", "error");
      return;
    }
    try {
      const created = await apiRequest<any>("/api/teams", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: teamDraft.description.trim(),
        }),
      });
      setTeams((prev) => [created, ...prev]);
      setTeamDraft({ name: "", description: "" });
      pushToast("تیم جدید ایجاد شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ایجاد تیم ناموفق بود.");
      pushToast(msg || "ایجاد تیم ناموفق بود.", "error");
    }
  };

  const removeTeamGroup = async (teamId: string) => {
    const team = teams.find((row) => row.id === teamId);
    if (!team) return;
    const confirmed = await confirmAction(`تیم "${team.name}" حذف شود؟`, {
      title: "حذف تیم",
      confirmLabel: "حذف",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await apiRequest<void>(`/api/teams/${teamId}`, { method: "DELETE" });
      setTeams((prev) => prev.filter((row) => row.id !== teamId));
      setTeamMembers((prev) => prev.map((member) => ({ ...member, teamIds: (member.teamIds ?? []).filter((id: string) => id !== teamId) })));
      pushToast("تیم حذف شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "حذف تیم ناموفق بود.");
      pushToast(msg || "حذف تیم ناموفق بود.", "error");
    }
  };

  const openEditMember = (member: any) => {
    setEditingMemberId(member.id);
    setMemberEditDraft({
      fullName: member.fullName,
      role: member.role,
      email: member.email,
      phone: member.phone,
      bio: member.bio,
      avatarDataUrl: member.avatarDataUrl ?? "",
      appRole: member.appRole ?? "member",
      isActive: member.isActive !== false,
      teamIds: member.teamIds ?? [],
      password: "",
    });
    setMemberEditErrors({});
    setMemberEditOpen(true);
  };

  const addMember = async () => {
    if (!canPerform("teamCreate")) {
      pushToast("دسترسی ایجاد عضو تیم را ندارید.", "error");
      return;
    }
    const next: Record<string, string> = {};
    if (!memberDraft.fullName.trim()) next.fullName = "نام عضو الزامی است.";
    if (!memberDraft.phone.trim()) next.phone = "شماره تماس الزامی است.";
    if (memberDraft.password.trim().length < 4) next.password = "رمز عبور باید حداقل ۴ کاراکتر باشد.";
    if (Object.keys(next).length) {
      setMemberErrors(next);
      return;
    }
    try {
      const created = await apiRequest<any>("/api/team-members", {
        method: "POST",
        body: JSON.stringify({
          fullName: memberDraft.fullName.trim(),
          role: memberDraft.role.trim(),
          email: memberDraft.email.trim(),
          phone: memberDraft.phone.trim(),
          password: memberDraft.password.trim(),
          bio: memberDraft.bio.trim(),
          avatarDataUrl: memberDraft.avatarDataUrl,
          appRole: memberDraft.appRole,
          isActive: memberDraft.isActive,
          teamIds: memberDraft.teamIds,
        }),
      });
      setTeamMembers((prev) => [created, ...prev]);
      setMemberDraft({
        fullName: "",
        role: "",
        email: "",
        phone: "",
        bio: "",
        avatarDataUrl: "",
        appRole: settingsDraft.team.defaultAppRole,
        isActive: true,
        teamIds: activeTeams[0]?.id ? [activeTeams[0].id] : [],
        password: "",
      });
      setMemberErrors({});
      setMemberOpen(false);
      setSelectedMemberId(created.id);
      pushToast("عضو جدید اضافه شد.");
    } catch {
      setMemberErrors({ fullName: "ثبت عضو انجام نشد." });
      pushToast("ثبت عضو ناموفق بود.", "error");
    }
  };

  const updateMember = async () => {
    if (!editingMemberId) return;
    if (!canPerform("teamUpdate", editingMemberId)) {
      pushToast("دسترسی ویرایش این عضو را ندارید.", "error");
      return;
    }
    const next: Record<string, string> = {};
    if (!memberEditDraft.fullName.trim()) next.fullName = "نام عضو الزامی است.";
    if (!memberEditDraft.phone.trim()) next.phone = "شماره تماس الزامی است.";
    if (memberEditDraft.password.trim() && memberEditDraft.password.trim().length < 4) {
      next.password = "رمز عبور باید حداقل ۴ کاراکتر باشد.";
    }
    if (Object.keys(next).length) {
      setMemberEditErrors(next);
      return;
    }
    if (!(await confirmAction("از اعمال تغییرات عضو تیم مطمئن هستید؟"))) return;
    try {
      const updated = await apiRequest<any>(`/api/team-members/${editingMemberId}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: memberEditDraft.fullName.trim(),
          role: memberEditDraft.role.trim(),
          email: memberEditDraft.email.trim(),
          phone: memberEditDraft.phone.trim(),
          password: memberEditDraft.password.trim(),
          bio: memberEditDraft.bio.trim(),
          avatarDataUrl: memberEditDraft.avatarDataUrl,
          appRole: memberEditDraft.appRole,
          isActive: memberEditDraft.isActive,
          teamIds: memberEditDraft.teamIds,
        }),
      });
      setTeamMembers((prev) => prev.map((member) => (member.id === editingMemberId ? updated : member)));
      setTasks((prev) =>
        prev.map((task) => ({
          ...task,
          assigner: task.assignerId === editingMemberId ? updated.fullName : task.assigner,
          assigneePrimary: task.assigneePrimaryId === editingMemberId ? updated.fullName : task.assigneePrimary,
          assigneeSecondary: task.assigneeSecondaryId === editingMemberId ? updated.fullName : task.assigneeSecondary,
        })),
      );
      setMemberEditOpen(false);
      setEditingMemberId(null);
      setMemberEditErrors({});
      pushToast("پروفایل عضو به‌روزرسانی شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "ویرایش عضو انجام نشد.");
      setMemberEditErrors({ fullName: msg || "ویرایش عضو انجام نشد." });
      pushToast(msg || "ویرایش عضو ناموفق بود.", "error");
    }
  };

  const removeMember = async (id: string) => {
    if (!canPerform("teamDelete")) {
      pushToast("دسترسی حذف عضو را ندارید.", "error");
      return;
    }
    const memberName = teamMemberNameById.get(id) ?? "این عضو";
    const confirmed = await confirmAction(`"${memberName}" حذف شود؟`, {
      title: "حذف عضو",
      confirmLabel: "حذف",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await apiRequest<void>(`/api/team-members/${id}`, { method: "DELETE" });
      setTeamMembers((prev) => prev.filter((member) => member.id !== id));
      setSelectedMemberId((prev) => (prev === id ? null : prev));
      pushToast("عضو حذف شد.");
    } catch (error) {
      const msg = normalizeUiMessage(String((error as Error)?.message ?? ""), "حذف عضو ناموفق بود.");
      const linkedToWork = /assigned to one or more projects|assigned to one or more tasks/i.test(msg);
      if (linkedToWork) {
        const doDeactivate = await confirmAction(
          "این عضو به پروژه/تسک متصل است و حذف مستقیم ممکن نیست. به‌جای حذف، غیرفعال شود؟",
          {
            title: "حذف ممکن نیست",
            confirmLabel: "غیرفعال‌سازی",
            destructive: true,
          },
        );
        if (doDeactivate) {
          try {
            const member = teamMembers.find((row) => row.id === id);
            if (!member) throw new Error("عضو یافت نشد.");
            const updated = await apiRequest<any>(`/api/team-members/${id}`, {
              method: "PATCH",
              body: JSON.stringify({
                fullName: member.fullName,
                role: member.role,
                email: member.email,
                phone: member.phone,
                password: "",
                bio: member.bio,
                avatarDataUrl: member.avatarDataUrl ?? "",
                appRole: member.appRole ?? "member",
                isActive: false,
              }),
            });
            setTeamMembers((prev) => prev.map((row) => (row.id === id ? updated : row)));
            pushToast("عضو غیرفعال شد.");
            return;
          } catch (deactivateError) {
            const deactivateMsg = normalizeUiMessage(String((deactivateError as Error)?.message ?? ""), "غیرفعال‌سازی عضو ناموفق بود.");
            setMemberErrors({ fullName: deactivateMsg || "غیرفعال‌سازی عضو ناموفق بود." });
            pushToast(deactivateMsg || "غیرفعال‌سازی عضو ناموفق بود.", "error");
            return;
          }
        }
      }
      setMemberErrors({ fullName: msg || "حذف عضو ناموفق بود." });
      pushToast(msg || "حذف عضو ناموفق بود.", "error");
    }
  };

  return {
    addTeamGroup,
    removeTeamGroup,
    openEditMember,
    addMember,
    updateMember,
    removeMember,
  };
};
