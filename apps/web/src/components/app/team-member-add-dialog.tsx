import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { BufferedInput, BufferedTextarea } from "@/components/ui/buffered-fields";
import { resolveAssetUrl } from "@/lib/asset-url";

type TeamMemberAddDialogProps = {
  memberOpen: boolean;
  setMemberOpen: (open: boolean) => void;
  memberDraft: any;
  setMemberDraft: (updater: (prev: any) => any) => void;
  memberErrors: Record<string, string>;
  memberInitials: (fullName: string) => string;
  pickAvatarForDraft: (file: File | undefined, mode: "add" | "edit") => Promise<void>;
  addMember: () => void;
  teams: Array<{ id: string; name: string }>;
};

export default function TeamMemberAddDialog({
  memberOpen,
  setMemberOpen,
  memberDraft,
  setMemberDraft,
  memberErrors,
  memberInitials,
  pickAvatarForDraft,
  addMember,
  teams,
}: TeamMemberAddDialogProps) {
  return (
    <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          افزودن عضو
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="liquid-glass">
        <DialogHeader>
          <DialogTitle>عضو جدید</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {memberDraft.avatarDataUrl ? (
              <img src={resolveAssetUrl(memberDraft.avatarDataUrl)} alt="avatar" className="h-14 w-14 rounded-full border object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full border bg-muted text-sm font-semibold">
                {memberInitials(memberDraft.fullName)}
              </div>
            )}
            <Input type="file" accept="image/*" onChange={(e) => void pickAvatarForDraft(e.target.files?.[0], "add")} />
          </div>
          <BufferedInput
            placeholder="نام و نام خانوادگی"
            value={memberDraft.fullName}
            onCommit={(next) => setMemberDraft((p) => ({ ...p, fullName: next }))}
          />
          {memberErrors.fullName && <p className="text-xs text-destructive">{memberErrors.fullName}</p>}
          <BufferedInput
            placeholder="سمت"
            value={memberDraft.role}
            onCommit={(next) => setMemberDraft((p) => ({ ...p, role: next }))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={memberDraft.appRole} onValueChange={(v) => setMemberDraft((p) => ({ ...p, appRole: v as any }))}>
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
              value={memberDraft.isActive ? "active" : "inactive"}
              onValueChange={(v) => setMemberDraft((p) => ({ ...p, isActive: v === "active" }))}
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
            value={memberDraft.email}
            onCommit={(next) => setMemberDraft((p) => ({ ...p, email: next }))}
          />
          <BufferedInput
            placeholder="شماره تماس"
            value={memberDraft.phone}
            onCommit={(next) => setMemberDraft((p) => ({ ...p, phone: next }))}
          />
          {memberErrors.phone && <p className="text-xs text-destructive">{memberErrors.phone}</p>}
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">عضویت در تیم‌ها</p>
            {teams.map((team) => (
              <label key={team.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={(memberDraft.teamIds ?? []).includes(team.id)}
                  onCheckedChange={() =>
                    setMemberDraft((prev) => {
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
            placeholder="رمز عبور"
            value={memberDraft.password}
            onCommit={(next) => setMemberDraft((p) => ({ ...p, password: next }))}
          />
          {memberErrors.password && <p className="text-xs text-destructive">{memberErrors.password}</p>}
          <BufferedTextarea
            placeholder="بیو / توضیح کوتاه"
            value={memberDraft.bio}
            onCommit={(next) => setMemberDraft((p) => ({ ...p, bio: next }))}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setMemberOpen(false)}>
            بستن
          </Button>
          <Button onClick={addMember}>ثبت عضو</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
