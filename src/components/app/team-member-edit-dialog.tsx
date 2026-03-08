import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { BufferedInput, BufferedTextarea } from "@/components/ui/buffered-fields";

type TeamMemberEditDialogProps = {
  memberEditOpen: boolean;
  setMemberEditOpen: (open: boolean) => void;
  setEditingMemberId: (value: string | null) => void;
  memberEditDraft: any;
  setMemberEditDraft: (updater: (prev: any) => any) => void;
  memberEditErrors: Record<string, string>;
  memberInitials: (fullName: string) => string;
  pickAvatarForDraft: (file: File | undefined, mode: "add" | "edit") => Promise<void>;
  updateMember: () => void;
  teams: Array<{ id: string; name: string }>;
};

export default function TeamMemberEditDialog({
  memberEditOpen,
  setMemberEditOpen,
  setEditingMemberId,
  memberEditDraft,
  setMemberEditDraft,
  memberEditErrors,
  memberInitials,
  pickAvatarForDraft,
  updateMember,
  teams,
}: TeamMemberEditDialogProps) {
  return (
    <Dialog
      open={memberEditOpen}
      onOpenChange={(open) => {
        setMemberEditOpen(open);
        if (!open) setEditingMemberId(null);
      }}
    >
      <DialogContent aria-describedby={undefined} className="liquid-glass">
        <DialogHeader>
          <DialogTitle>ویرایش پروفایل عضو</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {memberEditDraft.avatarDataUrl ? (
              <img src={memberEditDraft.avatarDataUrl} alt="avatar" className="h-14 w-14 rounded-full border object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full border bg-muted text-sm font-semibold">
                {memberInitials(memberEditDraft.fullName)}
              </div>
            )}
            <Input type="file" accept="image/*" onChange={(e) => void pickAvatarForDraft(e.target.files?.[0], "edit")} />
          </div>
          <BufferedInput
            placeholder="نام و نام خانوادگی"
            value={memberEditDraft.fullName}
            onCommit={(next) => setMemberEditDraft((p) => ({ ...p, fullName: next }))}
          />
          {memberEditErrors.fullName && <p className="text-xs text-destructive">{memberEditErrors.fullName}</p>}
          <BufferedInput
            placeholder="سمت"
            value={memberEditDraft.role}
            onCommit={(next) => setMemberEditDraft((p) => ({ ...p, role: next }))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={memberEditDraft.appRole} onValueChange={(v) => setMemberEditDraft((p) => ({ ...p, appRole: v as any }))}>
              <SelectTrigger>
                <SelectValue placeholder="نقش دسترسی" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">ادمین</SelectItem>
                <SelectItem value="manager">مدیر</SelectItem>
                <SelectItem value="member">عضو</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={memberEditDraft.isActive ? "active" : "inactive"}
              onValueChange={(v) => setMemberEditDraft((p) => ({ ...p, isActive: v === "active" }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="وضعیت" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">فعال</SelectItem>
                <SelectItem value="inactive">غیرفعال</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <BufferedInput
            placeholder="ایمیل"
            value={memberEditDraft.email}
            onCommit={(next) => setMemberEditDraft((p) => ({ ...p, email: next }))}
          />
          <BufferedInput
            placeholder="شماره تماس"
            value={memberEditDraft.phone}
            onCommit={(next) => setMemberEditDraft((p) => ({ ...p, phone: next }))}
          />
          {memberEditErrors.phone && <p className="text-xs text-destructive">{memberEditErrors.phone}</p>}
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">عضویت در تیم‌ها</p>
            {teams.map((team) => (
              <label key={team.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={(memberEditDraft.teamIds ?? []).includes(team.id)}
                  onCheckedChange={() =>
                    setMemberEditDraft((prev) => {
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
          <BufferedInput
            type="password"
            placeholder="رمز جدید (اختیاری)"
            value={memberEditDraft.password}
            onCommit={(next) => setMemberEditDraft((p) => ({ ...p, password: next }))}
          />
          {memberEditErrors.password && <p className="text-xs text-destructive">{memberEditErrors.password}</p>}
          <BufferedTextarea
            placeholder="بیو"
            value={memberEditDraft.bio}
            onCommit={(next) => setMemberEditDraft((p) => ({ ...p, bio: next }))}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setMemberEditOpen(false)}>
            بستن
          </Button>
          <Button onClick={updateMember}>ذخیره تغییرات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
