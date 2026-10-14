# مهاجرت داده

به‌روزرسانی ۲۰۲۶-۱۰-۱۳: migration 006/007/009 برای scope، backfill داده قدیمی PostgreSQL و الزام NOT NULL اضافه شد؛ test:upgrade روی پایگاه غیرخالی مصنوعی حفظ داده و اجرای مجدد را گذراند. واحد پول قدیمی NULL می‌ماند؛ migration 008 فقط ستون را اضافه می‌کند و مبلغ/واحد را حدس نمی‌زند. Source JSON مشتری همچنان فقط dry-run شده است. برای پایگاه قدیمی واقعی ابتدا backup و تطبیق schema لازم است؛ fixtures/test database تأیید restore مشتری نیستند.

داده واقعی این پروژه فقط dry-run شده است. apply واقعی یا جابه‌جایی فایل مشتری انجام نشده است.

## بررسی بدون تغییر

در ریشه پروژه:

```powershell
npm run db:migrate-json -- --source apps/api/data/db.json
```

خروجی شامل counts و issue code/شناسه رابطه است و نام، پیام، رمز یا محتوای مالی را چاپ نمی‌کند. این مسیر به دیتابیس وصل نمی‌شود و منبع را normalize نمی‌کند. خلاصه اجرای همین نسخه در `validation/source-migration-summary.json` است.

برای نام پروژه تکراری، فایل نگاشت خصوصی بسازید:

```json
{"TASK_ID": "EXACT_PROJECT_ID"}
```

```powershell
npm run db:migrate-json -- --source path/to/source.json --mapping path/to/mapping.json
```

شناسه پروژه موجود مقدم بر نام است. شناسه نامعتبر با نام مشابه جایگزین نمی‌شود. ورودی نامعتبر، رابطه شکسته، تاریخ نامعتبر یا مقدار مالی نامعتبر import را مسدود می‌کند.

## Apply به مقصد جدید

ابتدا backup خصوصی PostgreSQL موجود، منبع JSON، uploads و config را بگیرید. import فقط به یک دیتابیس/ schema جدید و خالی مجاز است. directory مربوط به source backup باید از قبل وجود داشته باشد. متغیر DATABASE_URL را صریح تنظیم کنید؛ هیچ URL یا راز نمونه برای داده واقعی استفاده نکنید.

```powershell
npm run prisma:generate
npm run prisma:deploy
npm run db:migrate-json -- --source path/to/source.json --mapping path/to/mapping.json --backup-dir path/to/private-backups --apply
```

اسکریپت ابتدا کپی immutable منبع را نگه می‌دارد، سپس کل import در transaction و advisory lock انجام می‌شود. مقصد غیرخالی رد می‌شود. source checksum و counts و snapshot کامل در MigrationImport ذخیره می‌شود. ورودی یکسان با اجرای مجدد داده تکراری نمی‌سازد؛ فایل backup موجود باید عین منبع باشد.

## کنترل و محدودیت‌ها

آزمون PostgreSQL fixture، شناسه پروژه انتخاب‌شده، نظر workflow، URL فایل، audit/notification، مقدار Decimal بزرگ، snapshot کامل، اجرای مجدد و رد مقصد غیرخالی را بررسی می‌کند.

همین نسخه ۱۳ عضو، ۴ پروژه، ۱ تسک و داده HR/مالی/chat دارد؛ هیچ‌یک به fixture عمومی تبدیل نشده‌اند. مشکل ownerId مالی در اسکریپت قبلی اصلاح شد؛ داده منبع userId مالی ندارد و نباید ownerId حذف یا حدس زده شود.

کپی blobهای uploads، checksum فایل‌ها و metadata نسخه‌ها، currency صریح و mapping عملیاتی فیلدهای اضافی هنوز باقی است. snapshot کامل صرفاً برای حفظ داده و تکمیل نگاشت است؛ مسیرهای عملیاتی هنوز از همه فیلدهای آرشیوشده استفاده نمی‌کنند. migrate روی PostgreSQL قدیمی غیرخالی یک مسیر backfill جدا می‌خواهد؛ import فعلی آن مسیر نیست.

## بازیابی

برای خطای transaction، مقصد import ناقص ندارد. منبع و backup را حفظ کنید. برای تغییر پس از import، restore کامل دیتابیس/فایل/config به محیط جدا و بررسی مستقل لازم است؛ restore به محیط مشتری در این مرحله تمرین نشده است. بازگشت image به‌تنهایی migration داده را برنمی‌گرداند.
