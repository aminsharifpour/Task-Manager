import { useEffect, useMemo, useState } from "react";
import { FileText, Pencil, Trash2, UserSquare2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import TeamMemberAddDialog from "@/components/app/team-member-add-dialog";
import { TablePagination } from "@/components/ui/table-pagination";

type TeamMembersCardProps = {
  memberOpen: boolean;
  setMemberOpen: (open: boolean) => void;
  memberDraft: any;
  setMemberDraft: (updater: (prev: any) => any) => void;
  memberErrors: Record<string, string>;
  memberInitials: (fullName: string) => string;
  pickAvatarForDraft: (file: File | undefined, mode: "add" | "edit") => Promise<void>;
  addMember: () => void;
  teams: Array<{ id: string; name: string; description?: string }>;
  teamDraft: { name: string; description: string };
  setTeamDraft: (updater: (prev: { name: string; description: string }) => { name: string; description: string }) => void;
  addTeamGroup: () => void;
  removeTeamGroup: (id: string) => Promise<void>;
  memberSearch: string;
  setMemberSearch: (value: string) => void;
  totalTeamMembers: number;
  filteredTeamMembers: any[];
  teamMembersVirtual: any;
  selectedMemberId: string | null;
  setSelectedMemberId: (id: string) => void;
  setMemberProfileOpen: (open: boolean) => void;
  openContextMenu: (event: React.MouseEvent, title: string, items: any[]) => void;
  openEditMember: (member: any) => void;
  openAccessEditor: (member: any) => void;
  copyTextToClipboard: (text: string, successMessage: string) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  roleLabel: (role: any) => string;
  toFaNum: (value: string) => string;
  moduleAccessOptions: Array<{ key: string; label: string }>;
  accessPresets: Array<any>;
  saveMemberAccessPreset: (payload: any) => Promise<void>;
};

export default function TeamMembersCard({
  memberOpen,
  setMemberOpen,
  memberDraft,
  setMemberDraft,
  memberErrors,
  memberInitials,
  pickAvatarForDraft,
  addMember,
  teams,
  teamDraft,
  setTeamDraft,
  addTeamGroup,
  removeTeamGroup,
  memberSearch,
  setMemberSearch,
  totalTeamMembers,
  filteredTeamMembers,
  teamMembersVirtual,
  selectedMemberId,
  setSelectedMemberId,
  setMemberProfileOpen,
  openContextMenu,
  openEditMember,
  openAccessEditor,
  copyTextToClipboard,
  removeMember,
  roleLabel,
  toFaNum,
  moduleAccessOptions,
  accessPresets,
  saveMemberAccessPreset,
}: TeamMembersCardProps) {
  const [membersPage, setMembersPage] = useState(1);
  const [membersPageSize, setMembersPageSize] = useState(20);
  const paginatedMembers = useMemo(() => {
    const start = (membersPage - 1) * membersPageSize;
    return filteredTeamMembers.slice(start, start + membersPageSize);
  }, [filteredTeamMembers, membersPage, membersPageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredTeamMembers.length / membersPageSize));
    if (membersPage > totalPages) setMembersPage(totalPages);
  }, [filteredTeamMembers.length, membersPage, membersPageSize]);

  const summarizeModuleAccess = (
    moduleAccess?: Record<string, boolean>,
    permissionOverrides?: Record<string, boolean>,
    policyOverrides?: Record<string, Record<string, string>>,
  ) => {
    const enabled = moduleAccessOptions.filter((item) => moduleAccess?.[item.key] !== false);
    const disabled = moduleAccessOptions.filter((item) => moduleAccess?.[item.key] === false);
    const hasCustomPermissions = Boolean(permissionOverrides && Object.keys(permissionOverrides).length > 0);
    const hasCustomPolicies = Boolean(policyOverrides && Object.keys(policyOverrides).length > 0);

    if (disabled.length === 0) {
      return (
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">کامل</Badge>
          {hasCustomPermissions || hasCustomPolicies ? <Badge variant="outline">سفارشی</Badge> : null}
        </div>
      );
    }

    if (disabled.length <= 2) {
      return (
        <div className="flex flex-wrap gap-1">
          {disabled.map((item) => (
            <Badge key={item.key} variant="outline" className="text-[11px]">
              بدون {item.label}
            </Badge>
          ))}
          {hasCustomPermissions || hasCustomPolicies ? <Badge variant="outline">سفارشی</Badge> : null}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-foreground">فعال: {toFaNum(String(enabled.length))} ماژول</p>
        <p className="text-[11px] text-muted-foreground">غیرفعال: {disabled.slice(0, 2).map((item) => item.label).join("، ")}{disabled.length > 2 ? " ..." : ""}</p>
        {hasCustomPermissions || hasCustomPolicies ? <p className="text-[11px] text-primary">دسترسی سفارشی فعال است</p> : null}
      </div>
    );
  };

  return (
    <section className="space-y-4">
      <Card className="oneui-hr-shell liquid-glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>اعضای تیم</CardTitle>
            <CardDescription>پروفایل هر شخص را ثبت کن و برای پروژه/تسک ابلاغ انجام بده.</CardDescription>
          </div>
          <TeamMemberAddDialog
            memberOpen={memberOpen}
            setMemberOpen={setMemberOpen}
            memberDraft={memberDraft}
            setMemberDraft={setMemberDraft}
            memberErrors={memberErrors}
            memberInitials={memberInitials}
            pickAvatarForDraft={pickAvatarForDraft}
            addMember={addMember}
            teams={teams}
            moduleAccessOptions={moduleAccessOptions}
            accessPresets={accessPresets}
            saveMemberAccessPreset={saveMemberAccessPreset}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="oneui-hr-panel rounded-[1.4rem] border p-3">
            <p className="mb-2 text-xs text-muted-foreground">مدیریت تیم‌ها</p>
            <div className="grid gap-2 md:grid-cols-[1fr_1.5fr_auto]">
              <Input
                placeholder="نام تیم (مثلا تیم بک‌اند)"
                value={teamDraft.name}
                onChange={(e) => setTeamDraft((prev) => ({ ...prev, name: e.target.value }))}
              />
              <Input
                placeholder="توضیح کوتاه تیم"
                value={teamDraft.description}
                onChange={(e) => setTeamDraft((prev) => ({ ...prev, description: e.target.value }))}
              />
              <Button type="button" onClick={addTeamGroup}>ایجاد تیم</Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {teams.map((team) => (
                <Badge key={team.id} variant="secondary" className="gap-1">
                  <span>{team.name}</span>
                  <button type="button" className="text-destructive" onClick={() => void removeTeamGroup(team.id)}>×</button>
                </Badge>
              ))}
            </div>
          </div>
          <Input placeholder="جستجو (نام/سمت/ایمیل)" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
          {filteredTeamMembers.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              {totalTeamMembers > 0 ? "نتیجه‌ای برای جستجوی فعلی پیدا نشد." : "هنوز عضوی ثبت نشده است."}
            </div>
          ) : (
            <>
              <div ref={teamMembersVirtual.ref} onScroll={teamMembersVirtual.onScroll} className="oneui-shared-table-shell max-h-[68vh] overflow-auto rounded-[1.5rem] border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-right font-medium">نام</th>
                      <th className="px-3 py-2 text-right font-medium">سمت</th>
                      <th className="px-3 py-2 text-right font-medium">تیم‌ها</th>
                      <th className="px-3 py-2 text-right font-medium">نقش</th>
                      <th className="px-3 py-2 text-right font-medium">دسترسی</th>
                      <th className="px-3 py-2 text-right font-medium">وضعیت</th>
                      <th className="px-3 py-2 text-right font-medium">ایمیل</th>
                      <th className="px-3 py-2 text-right font-medium">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMembers.map((member) => (
                      <tr
                        key={member.id}
                        className={`cursor-pointer border-t transition-colors hover:bg-muted/30 ${selectedMemberId === member.id ? "bg-primary/5" : ""}`}
                        onClick={() => {
                          setSelectedMemberId(member.id);
                          setMemberProfileOpen(true);
                        }}
                        onContextMenu={(event) =>
                          openContextMenu(event, `عضو: ${member.fullName}`, [
                            {
                              id: "member-open",
                              label: "نمایش پروفایل",
                              icon: UserSquare2,
                              onSelect: () => {
                                setSelectedMemberId(member.id);
                                setMemberProfileOpen(true);
                              },
                            },
                            { id: "member-edit", label: "ویرایش عضو", icon: Pencil, onSelect: () => openEditMember(member) },
                            { id: "member-access", label: "مدیریت دسترسی", icon: UserSquare2, onSelect: () => openAccessEditor(member) },
                            {
                              id: "member-copy-name",
                              label: "کپی نام عضو",
                              icon: FileText,
                              onSelect: () => {
                                void copyTextToClipboard(member.fullName, "نام عضو کپی شد.");
                              },
                            },
                            {
                              id: "member-delete",
                              label: "حذف عضو",
                              icon: Trash2,
                              tone: "danger",
                              onSelect: () => {
                                void removeMember(member.id);
                              },
                            },
                          ])
                        }
                      >
                        <td className="px-3 py-2 font-medium">{member.fullName}</td>
                        <td className="px-3 py-2">{member.role || "بدون سمت"}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {(member.teamIds ?? []).length === 0 ? (
                              <Badge variant="outline">بدون تیم</Badge>
                            ) : (
                              (member.teamIds ?? []).map((teamId: string) => {
                                const team = teams.find((row) => row.id === teamId);
                                return (
                                  <Badge key={`${member.id}-${teamId}`} variant="secondary">
                                    {team?.name ?? "نامشخص"}
                                  </Badge>
                                );
                              })
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline">{roleLabel(member.appRole)}</Badge>
                        </td>
                        <td className="px-3 py-2">{summarizeModuleAccess(member.moduleAccess, member.permissionOverrides, member.policyOverrides)}</td>
                        <td className="px-3 py-2">
                          <Badge variant={member.isActive === false ? "secondary" : "default"}>
                            {member.isActive === false ? "غیرفعال" : "فعال"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">{member.email || "بدون ایمیل"}</td>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="app-table-action" onClick={() => openEditMember(member)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="app-table-action" onClick={() => openAccessEditor(member)} title="مدیریت دسترسی">
                              <UserSquare2 className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="app-table-action text-destructive" onClick={() => void removeMember(member.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={membersPage}
                pageSize={membersPageSize}
                totalItems={filteredTeamMembers.length}
                onPageChange={setMembersPage}
                onPageSizeChange={(pageSize) => {
                  setMembersPageSize(pageSize);
                  setMembersPage(1);
                }}
                toFaNum={toFaNum}
              />
            </>
          )}
          {memberErrors.fullName && <p className="text-xs text-destructive">{memberErrors.fullName}</p>}
        </CardContent>
      </Card>
    </section>
  );
}
