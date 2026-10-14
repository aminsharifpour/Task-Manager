به‌روزرسانی ۲۰۲۶-۱۰-۱۴: جزئیات HR/مالی/تیم/گفتگو، core و فایل و realtime اکنون توسعه و آزمون شده‌اند. IMPLEMENTATION_STATUS و VALIDATION_REPORT مرجع جاری هستند؛ گزارش زیر انتقال پایه تاریخی است.

# انتقال ماژول‌های قدیمی — ۲۰۲۶-۱۰-۱۳

این مرحله، انتقال پایه ماژول‌ها به دامنه سازمان است؛ تکمیل همه جزئیات نسخه قدیمی یا آماده‌بودن عرضه را اثبات نمی‌کند.

## نتیجه اجرا

| بخش | انتقال اجراشده | محدودیت باقیمانده |
|---|---|---|
| اعضا/تیم | directory صفحه‌بندی‌شده، ایجاد حساب با رمز، نقش، مجوز HR/مالی، عضویت تیم، بایگانی و revoke؛ UI واقعی | پروفایل کامل، invitation UI و کنترل همه جزئیات تیم‌های بزرگ |
| پروژه | ویرایش نام/توضیح و قالب workflow، grant scoped | تاریخ، وضعیت، بایگانی و قالب‌های صنعت |
| تسک/workflow | ایجاد/فهرست/فیلتر/نظر/وضعیت/حذف با version، ۱۲ مرحله و انواع assignee/routing قدیمی، snapshot مستقل از قالب، approve/reject/advance تراکنشی و receipt idempotency | editor کامل workflow، زیرتسک/چک‌لیست/وابستگی/فایل |
| برد | همان query، فیلتر و صفحه تسک؛ کنترل وضعیت و تصمیم مجاز | drag/drop، برد کامل چندصفحه‌ای، گانت/تقویم جدید |
| صورت‌جلسه | CRUD scoped، همه فیلدهای متن قدیمی، UI ثبت/ویرایش/حذف | rich editor/attachment و ریزه‌کاری‌های قدیمی |
| chat | participant scope، direct/group، پیام/reply/forward/edit/delete/reaction/read/unread و mention در API؛ UI ارسال/پاسخ/ویرایش/حذف | پیوست، realtime/typing/presence، کنترل‌ها و pagination کامل UI |
| notification | recipient+organization+resource predicate یکسان برای فهرست/count/bulk، read/unread/dismiss/restore و preference scoped | delivery/toast/sound و قوانین همه تنظیمات هنوز یکپارچه نشده‌اند |
| HR | profile با کلید مرکب، leave/decision و attendance scoped؛ مجوز مستقل؛ self approval ممنوع؛ UI درخواست و مدیریت اولیه | پرونده/گزارش کامل و نگاشت واحد حقوق قدیمی |
| مالی | حساب/تراکنش/بودجه/history به ازای سازمان و هویت؛ Decimal رشته‌ای و currency صریح برای داده جدید؛ UI حساب/تراکنش | همه گزارش‌ها/ویرایش‌ها/بودجه در UI؛ واحد قدیمی بدون حدس می‌ماند |
| تنظیم بخش‌ها | server toggle همه ماژول‌ها، کنترل owner، امکان فعال‌سازی مجدد حتی با تیم غیرفعال | UI کامل تنظیمات سازمان |

## مرز داده و مجوز

همه endpointهای جدید زیر /api/organizations/:organizationId هستند. endpointهای سراسری قدیمی و socket/download قدیمی باز نشده‌اند. PostgreSQL بدون foundation دیگر اجرا نمی‌شود؛ legacy JSON صرفاً مسیر توسعه است.

Migration 006 scopeها و کلیدهای مرکب HR/notification preference را اضافه می‌کند. Migration 007 داده بدون scope را به legacy-default مستند backfill می‌کند؛ داده دارای scope قبلی حفظ و رابطه متعارض رد می‌شود. Migration 009 پس از backfill، scope مدل‌های عملیاتی را NOT NULL می‌کند و default ضمنی HR/preference را حذف می‌کند. FKهای مرکب parent و membership روابط میان دو سازمان را می‌بندند.

Migration 008 واحد مالی را اضافه می‌کند؛ مقدار داده قدیمی NULL می‌ماند. ثبت جدید تراکنش، بودجه یا حقوق باید واحد صریح IRR/IRT/USD/EUR بدهد. هیچ مبلغی از Decimal به Number تبدیل نمی‌شود. نمایش واحد ناشناخته در UI «واحد تعیین نشده» است.

HR و مالی از مجوز مستقل عضویت استفاده می‌کنند. نقش admin به‌تنهایی آنها را باز نمی‌کند. مالک می‌تواند grant بدهد؛ setup و سازمان جدید مالک اولیه را با grantهای صریح می‌سازند. امور مالی شخصی در هر سازمان به userId محدود است. Audit فعالیت‌های حساس HR/مالی/chat نیز فیلتر مجوز مستقل دارد.

گردش‌کار، snapshot تسک را نگه می‌دارد؛ تغییر قالب پروژه تسک فعال را عوض نمی‌کند. expectedVersion از تعارض جلوگیری می‌کند. receipt و payload hash موجب می‌شود retry یکسان همان نتیجه ثبت‌شده را برگرداند و همان کلید برای تصمیم متفاوت رد شود. قفل ردیف سازمان، تصمیم هم‌زمان و تغییر عضویت را هماهنگ می‌کند؛ این روش throughput بالا را اثبات نمی‌کند.

## آزمون واقعی

مدیر پروژه فقط پروژه دارای مالکیت یا grant صریح را مدیریت می‌کند. مسئول نقش‌محور workflow، تسک تخصیص‌یافته و سابقه تصمیم خودش را می‌بیند تا retry ممکن باشد؛ این دسترسی، مدیریت کل پروژه یا ویرایش عمومی تسک را باز نمی‌کند. DTO تسک عضویت و جزئیات داخلی پروژه را برنمی‌گرداند. frontend در تعارض 409، داده جاری را دوباره دریافت و خطا را حفظ می‌کند. log داخلی Prisma خاموش است تا خطای validation حاوی اطلاعات مشتری یا hash رمز چاپ نشود.

- test:modules: تیم/عضو، cross-organization CRUD/search/count، مهمان، role مستقل یک هویت، FK، HR/مالی مستقل، workflow concurrency/retry/reject، template snapshot، chat participant policy، notification/bulk، toggle و revoke.
- test:upgrade: PostgreSQL غیرخالی پیش از migration 006، backfill، حفظ شناسه/نظر/پیام/Decimal، unknown currency، اجرای مجدد و رد رکورد بدون scope.
- test:browser: login/project/org switch، عضو/تیم، task/comment/advance/approve/board، صورت‌جلسه، chat، مرخصی، account/transaction با currency، notification و logout.
- syntax/typecheck/build و smoke قدیمی JSON مصنوعی نیز گذشتند.
- تصاویر واقعی برد در عرض‌های ۳۶۰،۷۶۸ و ۱۴۴۰ ذخیره و desktop/mobile بازبینی شدند؛ clipping ناشی از scroll قدیمی و label انتخاب همکار اصلاح شد.

## مسیرها و اجرای محلی

پیش‌نمایش از review:foundation و production web bundle استفاده می‌کند؛ داده مصنوعی در schema مستقل review_foundation است. container فعلی shekof-foundation-local و PostgreSQL روی loopback:56432 است. container قبلی shekof-foundation-test خاموش است؛ همان volume توسط container جدید استفاده می‌شود و نباید هم‌زمان هر دو اجرا شوند.

صفحه ورود: http://127.0.0.1:8896/login. شماره مصنوعی 09000000200 و رمز Synthetic-Review-2026. هیچ import روی JSON اصلی یا تغییر فایل واقعی مشتری انجام نشده است.

## ادامه لازم

اولویت بعدی: storage/file metadata/version و مجوز دانلود و checksum migration فایل‌ها، سپس realtime scoped با revocation اتصال باز. پس از آن تکمیل جزئیات UI/تنظیمات/گزارش‌ها، signup/invitation، گانت/تقویم/قالب و هسته باقی‌مانده.

کل brief هنوز تکمیل نشده است. ظرفیت ۳۰۰ نفر، تست بار steady-state، Lighthouse landing، image/Compose install، TLS، reboot، restore و عرضه commercial تأیید نشده‌اند. کد legacy حذف نشده و قابلیت منتقل‌نشده به‌عنوان آماده تبلیغ نمی‌شود.

## مرحله فایل تسک — ۲۰۲۶-۱۰-۱۳

فایل جدید تسک، نسخه immutable، feedback همان نسخه، archive/restore، storage خصوصی محلی، checksum دانلود و quota تراکنشی اضافه شدند. جزئیات در [FILE_STORAGE.md](FILE_STORAGE.md) است. این بخش به معنای انتقال blobهای قدیمی یا فعال‌شدن پیوست chat/صورت‌جلسه نیست؛ مسیر عمومی قدیمی همچنان بسته است. schema اکنون ده migration دارد.

سایدبار/کارت‌ها/فرم‌های این قابلیت همان طراحی شکوفلو و IRANYekan را استفاده می‌کنند. test:files و browser واقعی با سناریوی فایل و downloadbytes گذشتند. ادامه: مهاجرت checksum فایل قدیمی، پیوست chat/صورت‌جلسه و adapter S3/reconciliation، سپس realtime با revocation.

## پیوست گفت‌وگو — ۲۰۲۶-۱۰-۱۳

پیوست جدید گفت‌وگو اکنون upload خصوصی، draft قابل بازیابی، binding پیام، دانلود participant، receipt ارسال و quota مشترک تسک/chat دارد. مستند [CHAT_ATTACHMENTS.md](CHAT_ATTACHMENTS.md) و migration 011 اضافه شدند. old payload در DB باقی است ولی به‌جای dataUrl در DTO وضعیت انتظار انتقال نشان داده می‌شود. اعمال انتقال blob قدیمی هنوز انجام نشده؛ dry-run یک blob معتبر و بدون issue یافت. فایل‌های صورت‌جلسه، S3، retention و realtime باقی هستند.
