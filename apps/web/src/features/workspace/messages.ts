// Translation foundation: only Persian is advertised until other dictionaries are complete.
export const workspaceMessages = {
  fa: {
    navigation: {
      search:"جستجوی فضای کار", dashboard:"داشبورد", projects:"پروژه‌ها", tasks:"تسک‌ها",
      teams:"اعضا و تیم‌ها", minutes:"صورت‌جلسه‌ها", chat:"گفت‌وگو", notifications:"اعلان‌ها",
      hr:"منابع انسانی", settings:"تنظیمات سیستم",
    },
  },
} as const;
export type WorkspaceLocale = keyof typeof workspaceMessages;
export const workspaceLocale:WorkspaceLocale = "fa";

const auditResources:Record<string,string>={organization:"سازمان",project:"پروژه",task:"تسک",team:"تیم",membership:"عضویت",member:"عضو",invitation:"دعوت",minute:"صورت‌جلسه",file:"فایل",chat:"گفتگو",hr:"منابع انسانی",account:"حساب مالی",transaction:"تراکنش",budget:"بودجه"};
const auditActions:Record<string,string>={settings_updated:"تنظیمات ذخیره شد",modules_updated:"ماژول‌ها تنظیم شدند",entitlement_changed:"ظرفیت و قابلیت‌ها تغییر کردند",profile_updated:"پرونده پرسنلی ویرایش شد",leave_requested:"مرخصی درخواست شد",leave_reviewed:"مرخصی بررسی شد",attendance_updated:"تردد ثبت یا ویرایش شد",attendance_deleted:"تردد حذف شد",created:"ایجاد شد",updated:"ویرایش شد",deleted:"حذف شد",removed:"برداشته شد",archived:"بایگانی شد",restored:"بازگردانی شد",revoked:"لغو شد",reactivated:"دوباره فعال شد",accepted:"پذیرفته شد",setup:"راه‌اندازی شد",signup:"ثبت‌نام شد",access_granted:"دسترسی اعطا شد",access_revoked:"دسترسی لغو شد",member_added:"عضو اضافه شد",member_removed:"عضو برداشته شد",legacy_files_imported:"فایل قدیمی منتقل شد",orphan_removed:"فایل بی‌مرجع پاک شد"};
export function auditMessage(action:string){const [resource,operation]=action.split(".");return (auditResources[resource]||"فضای کار")+": "+(auditActions[operation]||"فعالیت ثبت شد");}
