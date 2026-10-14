به‌روزرسانی ۲۰۲۶-۱۰-۱۴: local و S3، پیوست chat/صورت‌جلسه، بازبینی داخلی/مشتری، apply legacy با backup و reconciliation اجرا و آزموده شده‌اند؛ STORAGE_OPERATIONS و BACKUP_RESTORE مرجع جاری هستند. گزارش پایین سابقه مرحله 010 است.

# فایل‌ها و نسخه‌های پیوست تسک — ۲۰۲۶-۱۰-۱۳

این مرحله فایل‌های جدید تسک را به storage خصوصی محلی و metadata سازمانی PostgreSQL متصل می‌کند. تکمیل انتقال فایل‌های قدیمی، پیوست صورت‌جلسه یا adapter S3 را اثبات نمی‌کند.

## قابلیت‌های اجراشده

- پیوست جدید و نسخه جدید از UI واقعی تسک در فهرست و برد؛ تاریخچه نسخه صفحه‌بندی‌شده، دانلود نسخه انتخابی و بازخورد متصل به همان نسخه.
- بایگانی/بازگردانی بدون حذف نسخه‌ها؛ بایگانی‌شده در دانلود و فهرست عمومی تسک دیده نمی‌شود. مسئولان تسک می‌توانند فهرست بایگانی را ببینند و بازگردانی کنند.
- API ابتدا عضویت فعال، تنظیم files/tasks و دسترسی تسک را بررسی می‌کند. مهمان دارای grant پروژه فقط فایل همان تسک را می‌بیند، دانلود می‌کند و بازخورد می‌نویسد؛ بارگذاری و بایگانی برای مهمان بسته است. مالک/مدیر، مدیر پروژه مجاز، مسئولان اصلی/دوم/ایجادکننده و مسئول مرحله جاری اجازه تغییر دارند.
- نسخه باینری immutable است؛ کلید جدید برای هر نسخه با prefix SHA-256 سازمان و UUID فایل/نسخه ساخته می‌شود. نام نمایشی وارد مسیر storage نمی‌شود و مسیر عمومی /uploads همچنان بسته است.
- دانلود از API با JWT در header انجام می‌شود؛ URL حاوی token یا مسیر disk تولید نمی‌شود. پاسخ attachment، nosniff و private/no-store است. اندازه و SHA-256 پیش از دانلود بررسی می‌شوند؛ blob مفقود یا خراب با 410 رد می‌شود.
- درخواست بارگذاری دارای Idempotency-Key و hash محتوا/پارامترها/هویت است؛ retry یکسان نسخه تکراری نمی‌سازد. expectedVersion مانع overwrite نسخه هم‌زمان می‌شود.
- سقف server هر فایل ۲۰ MiB؛ PDF، PNG، JPEG، متن/CSV با UTF-8 معتبر، ZIP و Office مبتنی بر ZIP. extension و امضای اولیه محتوا بررسی می‌شوند. این بررسی parser کامل فایل یا آنتی‌ویروس نیست. نام حاوی separator، کنترل و bidi override رد می‌شود.
- سقف مهندسی اولیه سازمان ۱ GiB در Organization.storageByteLimit است؛ قیمت یا پلن تجاری نیست. محاسبه همه نسخه‌ها، از جمله بایگانی‌ها، و پذیرش بارگذاری در یک transaction با قفل سازمان انجام می‌شود. کاهش سقف نسخه موجود را حذف نمی‌کند؛ بارگذاری جدید تا داشتن فضا رد می‌شود. پنل تنظیم quota هنوز باقی است.

## مدل و قرارداد API

Migration 010 سه مدل TaskFile، TaskFileVersion و FileVersionFeedback و storageByteLimit را اضافه می‌کند. FKهای مرکب سازمان/تسک، سازمان/فایل، سازمان/نسخه و سازمان/عضو جلوی روابط متقاطع را می‌گیرند. metadata و feedback در PostgreSQL هستند؛ storageKey هیچ‌وقت در DTO مرورگر نیست.

مسیرها نسبت به `/api/organizations/:organizationId`:

| مسیر | عمل |
|---|---|
| GET /tasks/:taskId/files | فهرست، pagination، canUpload و اطلاعات quota برای عضو داخلی |
| POST /tasks/:taskId/files?name=... | فایل جدید؛ بدنه application/octet-stream و Idempotency-Key |
| POST /tasks/:taskId/files/:fileId/versions?name=...&expectedVersion=... | نسخه جدید همان فایل |
| GET /files/:fileId/versions | تاریخچه نسخه |
| GET /files/:fileId/versions/:versionId/download | دانلود دارای مجوز |
| GET/POST /files/:fileId/versions/:versionId/feedback | بازخورد همان نسخه |
| PATCH /files/:fileId/archive | archived و expectedVersion |

حذف تسک دارای metadata فایل در این مرحله با TASK_HAS_FILES رد می‌شود تا نسخه و بازخورد بی‌صاحب نشوند. بایگانی فایل حذف metadata نیست. پاک‌سازی دائمی با سیاست retention و backup هنوز طراحی/اجرا نشده است.

## storage و اجرای محلی

FILE_STORAGE_DRIVER فعلاً فقط local را می‌پذیرد؛ مقدار پشتیبانی‌نشده startup را متوقف می‌کند. PRIVATE_FILES_DIR می‌تواند مسیر volume خصوصی باشد؛ پیش‌فرض `apps/api/data/private-files` است و در Git/Docker context قرار نمی‌گیرد. readiness وجود directory را بررسی می‌کند. Compose volume مستقل api_private_files را به این مسیر وصل می‌کند؛ اجرای کامل نصب Compose هنوز در این مرحله تأیید نشده است.

adapter قرارداد put/get/remove دارد. put با exclusive create، sync و کلید اختصاصی انجام می‌شود؛ فایل موجود overwrite نمی‌شود. مسیرهای داخلی symlink رد می‌شوند. پس از rollback، blob جدید فقط وقتی پاک می‌شود که نبود مرجع DB تأیید شود؛ در قطع DB یا ابهام commit نگه داشته می‌شود تا نسخه ثبت‌شده تخریب نشود. crash می‌تواند blob بی‌مرجع باقی بگذارد؛ پاک‌سازی خودکار دائمی فعال نشده است.

backup باید هم PostgreSQL و هم private-files را با نقطه سازگار حفظ کند. فایل قدیمی uploads و snapshotهای import باید جدا نگه داشته شوند. انتقال منبع قدیمی بدون manifest نگاشت، checksum و رفع تعارض مجاز نیست و اجرا نشده است. فایل JSON اصلی همچنان checksum قبلی را دارد.

## بررسی

`npm run test:files` روی PostgreSQL واقعی و schema و storage موقت مستقل اجرا می‌شود: دسترسی متقاطع و چندعضویتی، مهمان/grant/revoke/logout، مسئول مستقیم و نقش‌محور workflow، retry و race نسخه، race سقف فضا، checksum خراب، محدودیت اندازه/type/path، بایگانی/بازگردانی، feedback نسخه و FKها.

`npm run test:browser` بارگذاری دو نسخه، دانلود bytes واقعی نسخه اول، بازخورد نسخه اول، بایگانی/بازگردانی و overflow در ۳۶۰/۷۶۸/۱۴۴۰ را به آزمون ماژول‌ها اضافه می‌کند. screenshots واقعی `docs/validation/screenshots/files-versions-*.png` هستند. verify:launch اکنون gate فایل‌ها را هم اجرا می‌کند.

گام بعد: manifest و مهاجرت checksum فایل قدیمی و پیوست chat/صورت‌جلسه، adapter S3 و reconciliation/retention، سپس realtime scoped با revocation اتصال باز. quota UI و پلن‌ها، approval مشتری و restore عملیاتی نیز کامل نشده‌اند.


مرحله جدید: پیوست chat و quota مشترک اکنون اجرا شده‌اند؛ CHAT_ATTACHMENTS.md مبنای وضعیت جدید است. اعمال manifest قدیمی، پیوست صورت‌جلسه، S3 و retention هنوز باقی‌اند.
