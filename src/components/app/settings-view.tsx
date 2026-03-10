// @ts-nocheck
import { PlugZap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { resolveAssetUrl } from "@/lib/asset-url";

export default function SettingsView(props: any) {
  const {
    settingsDraft,
    settingsErrors,
    setSettingsDraft,
    pickLogoForSettings,
    activeTeamMembers,
    normalizeTimeInput,
    transactionCategoryOptions,
    newTransactionCategory,
    setNewTransactionCategory,
    addTransactionCategory,
    removeTransactionCategory,
    PERMISSION_ITEMS,
    setTeamPermission,
    TASK_STATUS_ITEMS,
    setWorkflowTransition,
    WEBHOOK_EVENT_ITEMS,
    setWebhookEventEnabled,
    webhookTestBusy,
    testWebhookConnection,
    exportFullBackup,
    resetAllData,
    backupImportText,
    setBackupImportText,
    importFullBackup,
    settingsBusy,
    saveSettings,
  } = props;

  return (
    <>
      <Card className="liquid-glass lift-on-hover">
        <CardHeader>
          <CardTitle>تنظیمات عمومی</CardTitle>
          <CardDescription>مشخصات پایه نرم‌افزار و تیم را تنظیم کن.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {settingsDraft.general.logoDataUrl ? (
              <img src={resolveAssetUrl(settingsDraft.general.logoDataUrl)} alt="logo" className="h-16 w-16 rounded-xl border object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border bg-muted text-sm">لوگو</div>
            )}
            <Input type="file" accept="image/*" onChange={(e) => void pickLogoForSettings(e.target.files?.[0])} />
          </div>
          {settingsErrors.logo && <p className="text-xs text-destructive">{settingsErrors.logo}</p>}
          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="نام تیم/شرکت" value={settingsDraft.general.organizationName} onChange={(e) => setSettingsDraft((prev) => ({ ...prev, general: { ...prev.general, organizationName: e.target.value } }))} />
            <Input placeholder="منطقه زمانی (مثال: Asia/Tehran)" value={settingsDraft.general.timezone} onChange={(e) => setSettingsDraft((prev) => ({ ...prev, general: { ...prev.general, timezone: e.target.value } }))} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Select value={settingsDraft.general.weekStartsOn} onValueChange={(v) => setSettingsDraft((prev) => ({ ...prev, general: { ...prev.general, weekStartsOn: v } }))}>
              <SelectTrigger><SelectValue placeholder="شروع هفته" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="saturday">شنبه</SelectItem>
                <SelectItem value="sunday">یکشنبه</SelectItem>
              </SelectContent>
            </Select>
            <Input value="فارسی" disabled />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Select value={settingsDraft.general.theme} onValueChange={(v) => setSettingsDraft((prev) => ({ ...prev, general: { ...prev.general, theme: v } }))}>
              <SelectTrigger><SelectValue placeholder="حالت نمایش" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">روشن</SelectItem>
                <SelectItem value="dark">تاریک</SelectItem>
                <SelectItem value="system">طبق سیستم</SelectItem>
              </SelectContent>
            </Select>
            <Select value={settingsDraft.general.currentMemberId} onValueChange={(v) => setSettingsDraft((prev) => ({ ...prev, general: { ...prev.general, currentMemberId: v } }))}>
              <SelectTrigger><SelectValue placeholder="کاربر جاری" /></SelectTrigger>
              <SelectContent>
                {activeTeamMembers.map((member) => <SelectItem key={member.id} value={member.id}>{member.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="liquid-glass lift-on-hover">
          <CardHeader>
            <CardTitle>تنظیمات اعلان</CardTitle>
            <CardDescription>یادآورها و زمان ارسال هشدارها</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={settingsDraft.notifications.enabledDueToday} onCheckedChange={(c) => setSettingsDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, enabledDueToday: c === true } }))} /><span>یادآور تسک‌های امروز</span></label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={settingsDraft.notifications.enabledOverdue} onCheckedChange={(c) => setSettingsDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, enabledOverdue: c === true } }))} /><span>یادآور تسک‌های معوق</span></label>
            <Input type="text" inputMode="numeric" dir="ltr" placeholder="HH:mm" value={settingsDraft.notifications.reminderTime} onChange={(e) => setSettingsDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, reminderTime: normalizeTimeInput(e.target.value) } }))} />
            <Input type="number" min="1" placeholder="هشدار قبل از deadline (ساعت)" value={String(settingsDraft.notifications.deadlineReminderHours)} onChange={(e) => setSettingsDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, deadlineReminderHours: Math.max(1, Number(e.target.value || 1)) } }))} />
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={settingsDraft.notifications.escalationEnabled} onCheckedChange={(c) => setSettingsDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, escalationEnabled: c === true } }))} /><span>فعال‌سازی escalation به مدیر</span></label>
            <Input type="number" min="1" placeholder="Escalation اگر X ساعت بدون تغییر ماند" value={String(settingsDraft.notifications.escalationAfterHours)} onChange={(e) => setSettingsDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, escalationAfterHours: Math.max(1, Number(e.target.value || 1)) } }))} />
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs text-muted-foreground">کانال اعلان داخل نرم‌افزار</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={settingsDraft.notifications.channels.inAppTaskAssigned} onCheckedChange={(c) => setSettingsDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, channels: { ...prev.notifications.channels, inAppTaskAssigned: c === true } } }))} /><span>اعلان تسک ابلاغ‌شده</span></label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={settingsDraft.notifications.channels.inAppTaskNew} onCheckedChange={(c) => setSettingsDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, channels: { ...prev.notifications.channels, inAppTaskNew: c === true } } }))} /><span>اعلان تسک جدید</span></label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={settingsDraft.notifications.channels.inAppProjectNew} onCheckedChange={(c) => setSettingsDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, channels: { ...prev.notifications.channels, inAppProjectNew: c === true } } }))} /><span>اعلان پروژه جدید</span></label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={settingsDraft.notifications.channels.inAppChatMessage} onCheckedChange={(c) => setSettingsDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, channels: { ...prev.notifications.channels, inAppChatMessage: c === true } } }))} /><span>اعلان پیام جدید</span></label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={settingsDraft.notifications.channels.inAppMention} onCheckedChange={(c) => setSettingsDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, channels: { ...prev.notifications.channels, inAppMention: c === true } } }))} /><span>اعلان منشن</span></label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={settingsDraft.notifications.channels.inAppSystem} onCheckedChange={(c) => setSettingsDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, channels: { ...prev.notifications.channels, inAppSystem: c === true } } }))} /><span>اعلان‌های سیستمی</span></label>
                <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={settingsDraft.notifications.channels.soundOnMessage} onCheckedChange={(c) => setSettingsDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, channels: { ...prev.notifications.channels, soundOnMessage: c === true } } }))} /><span>پخش صدای پیام جدید</span></label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="liquid-glass lift-on-hover">
          <CardHeader>
            <CardTitle>تنظیمات تقویم شمسی</CardTitle>
            <CardDescription>نمایش رویدادها و بازه پیش‌فرض تقویم</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={settingsDraft.calendar.showTasks} onCheckedChange={(c) => setSettingsDraft((prev) => ({ ...prev, calendar: { ...prev.calendar, showTasks: c === true } }))} /><span>نمایش تسک‌ها در تقویم</span></label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={settingsDraft.calendar.showProjects} onCheckedChange={(c) => setSettingsDraft((prev) => ({ ...prev, calendar: { ...prev.calendar, showProjects: c === true } }))} /><span>نمایش پروژه‌ها در تقویم</span></label>
            <Select value={settingsDraft.calendar.defaultRange} onValueChange={(v) => setSettingsDraft((prev) => ({ ...prev, calendar: { ...prev.calendar, defaultRange: v } }))}>
              <SelectTrigger><SelectValue placeholder="بازه پیش‌فرض" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">ماهانه</SelectItem>
                <SelectItem value="weekly">هفتگی</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </section>

      <Card className="liquid-glass lift-on-hover">
        <CardHeader>
          <CardTitle>دسته‌بندی حسابداری</CardTitle>
          <CardDescription>دسته‌های قابل انتخاب برای ثبت تراکنش را از اینجا مدیریت کن.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="مثال: اینترنت / خوراک / سرمایه‌گذاری" value={newTransactionCategory} onChange={(e) => setNewTransactionCategory(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTransactionCategory(); } }} />
            <Button type="button" variant="outline" onClick={addTransactionCategory}>افزودن دسته</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {transactionCategoryOptions.map((category) => (
              <Badge key={`acct-cat-${category}`} variant="outline" className="gap-2">
                <span>{category}</span>
                <button type="button" className="text-destructive" onClick={() => removeTransactionCategory(category)} aria-label={`حذف ${category}`}>×</button>
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">این گزینه‌ها در فرم ثبت/ویرایش تراکنش به صورت دراپ‌داون نمایش داده می‌شوند.</p>
        </CardContent>
      </Card>

      <Card className="liquid-glass lift-on-hover">
        <CardHeader>
          <CardTitle>تنظیمات تیم و دسترسی</CardTitle>
          <CardDescription>نقش پیش‌فرض و سطح دسترسی اعضا</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={settingsDraft.team.defaultAppRole} onValueChange={(v) => setSettingsDraft((prev) => ({ ...prev, team: { ...prev.team, defaultAppRole: v } }))}>
            <SelectTrigger><SelectValue placeholder="نقش پیش‌فرض عضو جدید" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">ادمین</SelectItem>
              <SelectItem value="manager">مدیر</SelectItem>
              <SelectItem value="member">عضو</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={settingsDraft.team.memberCanEditTasks} onCheckedChange={(c) => setSettingsDraft((prev) => ({ ...prev, team: { ...prev.team, memberCanEditTasks: c === true } }))} /><span>اعضای عادی بتوانند تسک را ویرایش کنند</span></label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={settingsDraft.team.memberCanDeleteTasks} onCheckedChange={(c) => setSettingsDraft((prev) => ({ ...prev, team: { ...prev.team, memberCanDeleteTasks: c === true } }))} /><span>اعضای عادی بتوانند تسک را حذف کنند</span></label>
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground"><tr><th className="px-2 py-2 text-right font-medium">عملیات</th><th className="px-2 py-2 text-center font-medium">ادمین</th><th className="px-2 py-2 text-center font-medium">مدیر</th><th className="px-2 py-2 text-center font-medium">عضو</th></tr></thead>
              <tbody>
                {PERMISSION_ITEMS.map((item) => (
                  <tr key={item.action} className="border-t">
                    <td className="px-2 py-2">{item.label}</td>
                    <td className="px-2 py-2 text-center"><Checkbox checked={settingsDraft.team.permissions.admin[item.action]} onCheckedChange={(c) => setTeamPermission("admin", item.action, c === true)} /></td>
                    <td className="px-2 py-2 text-center"><Checkbox checked={settingsDraft.team.permissions.manager[item.action]} onCheckedChange={(c) => setTeamPermission("manager", item.action, c === true)} /></td>
                    <td className="px-2 py-2 text-center"><Checkbox checked={settingsDraft.team.permissions.member[item.action]} onCheckedChange={(c) => setTeamPermission("member", item.action, c === true)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="liquid-glass lift-on-hover">
        <CardHeader>
          <CardTitle>Workflow تسک</CardTitle>
          <CardDescription>قوانین انتقال وضعیت بین todo / doing / blocked / done</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={settingsDraft.workflow.requireBlockedReason} onCheckedChange={(c) => setSettingsDraft((prev) => ({ ...prev, workflow: { ...prev.workflow, requireBlockedReason: c === true } }))} /><span>برای وضعیت Blocked ثبت دلیل اجباری باشد</span></label>
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground"><tr><th className="px-2 py-2 text-right font-medium">از \\ به</th>{TASK_STATUS_ITEMS.map((to) => <th key={`wf-head-${to.value}`} className="px-2 py-2 text-center font-medium">{to.label}</th>)}</tr></thead>
              <tbody>
                {TASK_STATUS_ITEMS.map((from) => (
                  <tr key={`wf-row-${from.value}`} className="border-t">
                    <td className="px-2 py-2 font-medium">{from.label}</td>
                    {TASK_STATUS_ITEMS.map((to) => {
                      const disabled = from.value === to.value;
                      const checked = disabled || settingsDraft.workflow.allowedTransitions[from.value]?.includes(to.value);
                      return <td key={`wf-${from.value}-${to.value}`} className="px-2 py-2 text-center"><Checkbox disabled={disabled} checked={checked} onCheckedChange={(c) => setWorkflowTransition(from.value, to.value, c === true)} /></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="liquid-glass lift-on-hover">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PlugZap className="h-4 w-4" />Integration - Webhook</CardTitle>
          <CardDescription>ارسال رویدادهای مهم به سرویس‌های خارجی (Slack/CRM/Automation)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={settingsDraft.integrations.webhook.enabled} onCheckedChange={(c) => setSettingsDraft((prev) => ({ ...prev, integrations: { ...prev.integrations, webhook: { ...prev.integrations.webhook, enabled: c === true } } }))} /><span>فعال‌سازی Webhook</span></label>
          <Input placeholder="Webhook URL (https://...)" value={settingsDraft.integrations.webhook.url} onChange={(e) => setSettingsDraft((prev) => ({ ...prev, integrations: { ...prev.integrations, webhook: { ...prev.integrations.webhook, url: e.target.value } } }))} />
          <Input placeholder="Webhook Secret (اختیاری برای امضای HMAC)" value={settingsDraft.integrations.webhook.secret} onChange={(e) => setSettingsDraft((prev) => ({ ...prev, integrations: { ...prev.integrations, webhook: { ...prev.integrations.webhook, secret: e.target.value } } }))} />
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs text-muted-foreground">رویدادهای ارسالی</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {WEBHOOK_EVENT_ITEMS.map((eventRow) => <label key={eventRow.key} className="flex items-center gap-2 text-sm"><Checkbox checked={settingsDraft.integrations.webhook.events.includes(eventRow.key)} onCheckedChange={(c) => setWebhookEventEnabled(eventRow.key, c === true)} /><span>{eventRow.label}</span></label>)}
            </div>
          </div>
          <Button type="button" variant="outline" disabled={webhookTestBusy} onClick={testWebhookConnection}>{webhookTestBusy ? "در حال تست..." : "تست اتصال Webhook"}</Button>
        </CardContent>
      </Card>

      <Card className="liquid-glass lift-on-hover">
        <CardHeader>
          <CardTitle>پشتیبان‌گیری و بازیابی</CardTitle>
          <CardDescription>خروجی JSON، ایمپورت و ریست کامل داده‌ها</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={exportFullBackup}>خروجی JSON بکاپ</Button>
            <Button type="button" variant="destructive" onClick={resetAllData}>ریست کامل داده‌ها</Button>
          </div>
          <Textarea placeholder="JSON بکاپ را اینجا قرار بده و ایمپورت کن" value={backupImportText} onChange={(e) => setBackupImportText(e.target.value)} />
          {settingsErrors.backup && <p className="text-xs text-destructive">{settingsErrors.backup}</p>}
          <Button type="button" variant="secondary" onClick={importFullBackup}>ایمپورت بکاپ</Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        {settingsErrors.save && <p className="text-xs text-destructive">{settingsErrors.save}</p>}
        <Button type="button" disabled={settingsBusy} onClick={saveSettings}>{settingsBusy ? "در حال ذخیره..." : "ذخیره تنظیمات"}</Button>
      </div>
    </>
  );
}
