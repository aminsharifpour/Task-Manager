به‌روزرسانی ۲۰۲۶-۱۰-۱۴: UI فوروارد/مدیریت گروه/mention/draft صفحه‌بندی‌شده و ضبط/پخش صوت مجاز افزوده شده‌اند. apply واقعی فقط روی fixture با archive و ledger آزموده شده؛ منبع اصلی دست‌نخورده است. گزارش پایین سابقه مرحله 011 است.

# پیوست گفت‌وگو و بررسی فایل قدیمی — ۲۰۲۶-۱۰-۱۳

Migration 011 مدل‌های ChatAttachment و ChatMessageAttachment و receipt ارسال پیام را اضافه می‌کند. فایل جدید گفت‌وگو در همان storage خصوصی محلی و quota سازمانی تسک‌ها ذخیره می‌شود. منابع در `modules/chat/attachments.js` و `attachment-policy.js` و UI در `features/workspace/chat-panel.tsx` هستند.

## رفتار اجراشده

- upload باینری دارای Idempotency-Key، محدودیت ۲۰ MiB و همان سیاست نوع/نام فایل تسک؛ بررسی فعال‌بودن files/chat، عضویت سازمان و participant گفت‌وگو.
- فایل آماده ارسال فقط برای بارگذار همان گفت‌وگو قابل فهرست‌کردن است. reload باعث گم‌شدن draft نمی‌شود؛ کاربر می‌تواند draft را انتخاب و ارسال یا کنار بگذارد. کنار گذاشتن حذف فیزیکی نیست و quota همچنان مصرف می‌شود.
- پیام متنی، فقط پیوست یا متن+پیوست؛ حداکثر پنج پیوست. binding در transaction انجام می‌شود و فایل آماده کاربر دیگر یا گفت‌وگوی دیگر قابل استفاده نیست.
- idempotency ارسال بر اساس سازمان/فرستنده/کلید و hash محتوای درخواست؛ پاسخ گم‌شده باعث message/unread/notification تکراری نمی‌شود.
- دانلود فقط از مسیر پیام دارای link واقعی و participant فعلی همان گفت‌وگو؛ داشتن attachmentId به‌تنهایی کافی نیست. پاسخ attachment/no-store/nosniff و کنترل اندازه/SHA-256.
- حذف نرم پیام لینک دانلود همان پیام را می‌بندد. فوروارد مجاز، link مستقلی در گفت‌وگوی مقصد دارد؛ حذف پیام مبدأ، پیام فورواردشده مجاز را حذف نمی‌کند. API فوروارد بررسی شده؛ کنترل فوروارد در UI هنوز باقی است.
- DTO پیام فقط metadata امن پیوست جدید را برمی‌گرداند؛ storageKey، receipt hash و payload/dataUrl قدیمی به مرورگر نمی‌روند. پیوست قدیمی با legacyAttachmentsPending مشخص می‌شود و پیش از انتقال نمی‌تواند فوروارد شود.
- مجموع TaskFileVersion و ChatAttachment زیر همان قفل ردیف سازمان سنجیده می‌شود؛ concurrent upload تسک و chat نمی‌تواند quota را دور بزند. draft کنارگذاشته و نسخه بایگانی‌شده حذف نشده‌اند.
- پیام‌ها صفحه‌بندی شده‌اند. UI فارسی و IRANYekan/طراحی شکوفلو، انتخاب فایل محلی، دانلود، حفظ draft، لغو انتخاب و retry دارد. تازه‌سازی فعلاً polling است؛ realtime ادعا نمی‌شود.

## مسیرهای API

همه مسیرها زیر `/api/organizations/:organizationId` هستند:

| مسیر | کاربرد |
|---|---|
| POST /chat/conversations/:id/attachments?name=... | upload؛ application/octet-stream و Idempotency-Key |
| GET /chat/conversations/:id/attachments/drafts | draftهای خود کاربر با pagination |
| POST /chat/attachments/:id/discard | کنار گذاشتن draft غیرمتصل و متعلق به خود کاربر |
| POST /chat/conversations/:id/messages | text، attachmentIds، idempotencyKey و reply/forward |
| GET /chat/messages/:id/attachments/:attachmentId/download | دانلود با مجوز خود پیام |

حذف دائمی گفت‌وگوی دارای فایل نگهداری‌شده با CHAT_HAS_FILES رد می‌شود؛ retention/reconciliation هنوز اجرا نشده‌اند. نمایش draft UI فعلاً تا ۱۰۰ مورد است؛ endpoint صفحه‌بندی دارد. ضبط/پخش voice جدید و previews هنوز پیاده نشده‌اند.

## بررسی انتقال قدیمی

`npm run files:plan-legacy -- --source ... --uploads ... --organization-id ... --report ...` یک **dry-run صرف** است و --apply را رد می‌کند. منبع، root و report باید صریح باشند. report با exclusive create ساخته می‌شود و فایل قبلی را overwrite نمی‌کند؛ نام‌ها/شناسه‌های واقعی فقط در report خصوصی `.tmp` باقی می‌مانند. هیچ ارتباط شبکه برای URL قدیمی انجام نمی‌شود.

planner برای ChatMessage.attachments، داده inline base64 و فایل محلی uploads را بررسی، SHA-256 و اندازه را ثبت و path escape، blob مفقود، base64 خراب، remote URL، اندازه متعارض و mapping ناقص را گزارش می‌کند. databaseVerified همیشه false است؛ ارائه organizationId فقط نگاشت پیشنهادی است و وجود/رابطه پیام و سازمان را اثبات نمی‌کند. source bytes، فایل‌ها و DB را تغییر نمی‌دهد. فایل‌های سایر دامنه‌ها خارج از این planner هستند.

روی منبع فعلی، یک پیوست و یک blob معتبر و صفر issue پیدا شد. این **اعمال مهاجرت نیست**؛ باید مقصد import‌شده، scope پیام/فرستنده، نوع legacy، manifest و checksum دوباره تطبیق و سپس apply جداگانه ساخته/آزموده شود. checksum JSON اصلی همچنان قبلی است. خلاصه بدون اطلاعات خصوصی در `validation/legacy-chat-files-summary.json` است.

## اعتبارسنجی و ادامه

test:files اکنون draft privacy، تصاحب draft، upload/send retry، دانلود participant و outsider، فوروارد scope، حذف پیام، حذف participant/revoke، محدودیت مشترک task/chat و FKها را پوشش می‌دهد. browser فایل واقعی را ارسال/دانلود می‌کند؛ پاسخ ارسال را پس از commit قطع و retry را از نظر نبود پیام دوگانه می‌سنجد و draft را پس از reload بازیابی می‌کند. screenshotهای chat-attachments-360/768/1440 واقعی و مصنوعی‌اند.

ادامه: apply کنترل‌شده manifest روی مقصد import‌شده، پیوست صورت‌جلسه، S3 و retention/reconciliation؛ سپس realtime با revocation اتصال باز. نصب/restore/ظرفیت تجاری هنوز تأیید نشده‌اند.
