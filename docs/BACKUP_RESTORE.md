# پشتیبان‌گیری و بازیابی

به‌روز: ۲۰۲۶-۱۰-۱۴. خروجی یک سازمان با backup کل نصب متفاوت است. خروجی scoped NDJSON با trailer کامل پیاده شده است؛ هیچ password/session/blob key در آن نیست و snapshot سراسری یا backup فایل محسوب نمی‌شود. endpointهای backup/reset قدیمی در حالت سازمانی بسته‌اند.

## نصب Compose با local storage

`node scripts/compose-backup.mjs --project shekof --env-file /secure/release.env --output /new/backup-dir`

مقصد باید جدید باشد. همه APIهای پروژه در تمام مدت dump و کپی فایل متوقف می‌شوند، سپس راه‌اندازی می‌شوند. dump باینری با stream Node مستقیماً ذخیره می‌شود؛ PowerShell redirect استفاده نمی‌شود. همه نسخه‌ها، draftها، فایل‌های بایگانی و orphanهای موجود حفظ می‌شوند. configuration.env شامل secret است و همراه checksum پایگاه و هر فایل در manifest ثبت می‌شود. این backup رمزگذاری‌شده نیست؛ directory را با دسترسی محدود و در مخزن backup خصوصی/رمزگذاری‌شده نگه دارید. در Windows، chmod جای ACL را نمی‌گیرد. replication یا writer خارج این Compose باید جدا متوقف شود.

`node scripts/compose-restore.mjs --project shekof-restored --env-file /secure/restore.env --input /backup-dir`

restore فقط در پروژه کاملاً جدید، بدون container و volume قبلی مجاز است. همه checksumها پیش از نخستین تغییر کنترل می‌شوند. پایگاه و فایل‌ها برگردانده، ownership فایل‌های تازه تنظیم و migration یک‌بار اجرا می‌شود. فایل configuration.env برای بازیابی تنظیمات در backup وجود دارد ولی خودکار روی تنظیم مقصد نوشته نمی‌شود: credential، دامنه، پورت و image مقصد را آگاهانه انتخاب کنید. فایل یا volume نصب اصلی پاک نمی‌شود. پس از restore، readiness، login، شمارش/روابط و `files:reconcile` و دانلود فایل‌های نمونه را بررسی کنید.

آزمون `test:release` روی داده مصنوعی واقعاً dump/restore مستقل و تطابق بایت فایل را بررسی کرده است. restart container آزموده می‌شود؛ reboot فیزیکی میزبان از این آزمون نتیجه‌گیری نمی‌شود. RPO/RTO به برنامه و سخت‌افزار انتخاب‌شده وابسته‌اند و تضمین عددی ندارند.

## S3-compatible

تمام API replicaها و فرآیند reconciliation/پاک‌سازی را متوقف کنید. dump سازگار PostgreSQL و نسخه محرمانه config را بگیرید، SHA256 dump را محاسبه کنید. با محیط S3 مبدأ:

`node apps/api/scripts/object-snapshot.mjs --mode backup --directory /new/objects --database-sha256 <dump-sha256> --writers-stopped`

این ابزار همه objectهای معتبر prefix را با کلید ثابت، اندازه و checksum کپی می‌کند؛ object ناشناخته مانع اعلام تکمیل backup است. manifest فقط با همان dump جفت می‌شود. برای restore پایگاه جدید را از dump برگردانید، محیط را به bucket/prefix تازه خالی تغییر دهید و فرمان بالا را با `--mode restore` اجرا کنید. مقصد غیرخالی رد می‌شود، checksum تمام ورودی‌ها پیش از نوشتن و دانلود هر object پس از نوشتن بررسی می‌شود. سپس reconciliation همه metadataهای DB و objectها را تطبیق دهید و writerها را راه‌اندازی کنید. آزمون واقعی S3، restore به prefix تازه، checksum، جفت dump و رد مقصد غیرخالی را پوشش می‌دهد. versioning سرویس S3 به‌تنهایی جای dump هماهنگ پایگاه نیست.

## زمان‌بندی و نگهداری

نمونه systemd timer/service در deploy/shekof-backup.* وجود دارد. Node و Docker CLI روی میزبان نگهداری لازم‌اند. پوشه backup-root را قبلاً خصوصی بسازید، مسیر env و برنامه OnCalendar را مطابق پنجره توقف انتخاب و فقط پس از آزمون دستی فعال کنید. این فایل‌ها روی رایانه حاضر نصب/فعال نشده‌اند. روی Windows، Task Scheduler می‌تواند `scripts/backup-scheduled.mjs` را با همان آرگومان‌ها اجرا کند. برنامه، نام مقصد یکتا می‌سازد و backup قبلی را بازنویسی یا حذف نمی‌کند. retention backup باید توسط مالک انتخاب شود؛ حذف خودکار نسخه‌های پشتیبان فعال نیست.

source archive مهاجرت JSON/blob و manifestهای آن را جدا همراه backup نگه دارید. منبع اصلی این پروژه تغییر نکرده است. فایل‌های دارای مرجع DB هرگز با reconciliation حذف نمی‌شوند؛ orphan فقط با درخواست صریح، حداقل هفت روز سن، قفل سازمان و کنترل دوباره مرجع پاک می‌شود.
