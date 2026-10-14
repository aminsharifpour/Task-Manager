# گزارش بررسی نسخه

به‌روز: ۲۰۲۶-۱۰-۱۴. پروژه ZIP در E:\Task-Manager-main، بدون Git است؛ commit دقیق brief روی آن قابل اثبات نیست. آزمون‌ها روی داده مصنوعی، schemaهای یکتای دیتابیس جدا shekof_test و containerهای موقت انجام شدند. منبع JSON اصلی تغییر نکرده است.

## شواهد جاری

| بررسی | نتیجه ثبت‌شده |
|---|---|
| syntax/types/build و smoke | موفق؛ نسخه وب production ساخته شد |
| foundation | ۹ آزمون سیاست/اعتبارسنجی/migration/planner موفق |
| tenant PostgreSQL و setup | scope/نقش/ظرفیت/هم‌زمانی/مهمان/نشست و setup یک‌باره موفق |
| modules/core | CRUD سازمانی، HR/مالی مستقل، workflow retry/race، قالب/فیلد/چرخه/وابستگی/چک‌لیست/زمان/ظرفیت/داشبورد موفق |
| operations | خروجی scoped کامل، جستجو و مرزها، دقت Decimal/بودجه، لغو grant، تبدیل مسئول پروژه به مهمان، metrics خصوصی و preference قدیمی موفق |
| accounts | signup/setup/invite/session/password/entitlement و دو signup هم‌زمان با یک شماره، کنترل حد bcrypt موفق |
| realtime | دو replica، حضور/تایپ، payload بدون متن خصوصی، لغو اتاق/عضویت/نشست و محدودیت مسئول قبلی پس از guest شدن موفق |
| files/legacy blobs | نسخه/review/feedback، پیوست chat/minute، quota race، immutable/checksum/deny، ledger/backup/idempotency و apply fixture موفق |
| upgrade PostgreSQL | schema غیرخالی قدیمی، حفظ شناسه/رابطه/نظر/پیام/Decimal و rerun موفق |
| browser | RTL/IRANYekan هشت وزن، 360/768/1440، keyboard/reduced-motion، پروژه/تیم/تسک/برد/تأیید/فایل/صورت‌جلسه/chat/HR/مالی/خروج موفق |
| browser جدید | export با trailer، نتیجه جستجو و منبع واقعی، پیوست صورت‌جلسه، ویرایش تیم، متن ذخیره‌نشده و تراکم ماندگار موفق |
| voice browser | ضبط با دستگاه Fake Default Audio Input، ارسال پیوست و دانلود برای audio با metadata قابل پخش موفق؛ میکروفون واقعی کاربر استفاده نشده |
| onboarding browser | self-hosted setup، calendar/settings/account، hosted org دوم، signup دعوت و review مهمان موفق |
| landing browser/Lighthouse | فرم DB/idempotency/CTA، metadata HTML و private noindex، عدم بارگذاری chunk خصوصی؛ mobile معتبر Performance91 / Accessibility96 |
| S3 واقعی | RustFS با digest ثابت؛ conditional write، size/key/TLS و snapshot/restore prefix تازه با checksum/pairing dump موفق |
| Compose واقعی | نصب production تمیز، TLS CA داخلی، API غیر root/پورت خصوصی، restart، dump/file/config restore مستقل، upgrade schema18->19 و restore backup پیشین موفق |

یک Lighthouse به NO_NAVSTART ابزار خورد؛ آن trace امتیاز معتبر نیست. گزارش خطا جدا نگهداری و retry فقط برای خطای trace انجام شد. خطای هدر microphone=() با اجازه same-origin در صفحات برنامه/ورود اصلاح شد؛ public landing مجوز میکروفون ندارد. آزمون ضبط پس از اصلاح عبور کرد.

## بار مصنوعی واقعی

۱۰ سازمان، بزرگ‌ترین با ۳۰۰ عضو و ۵۰هزار تسک، API با صفحه۲۵، فکر۱۰۰۰..۲۰۰۰ms، فهرست۵۰٪/داشبورد۲۰٪/جستجو۲۰٪/نوشتن۱۰٪، یک WebSocket برای هر کاربر. فایل در این سناریو صفر بایت است؛ این آزمون انتقال فایل یا زمان render UI نیست. Windows i7-12700KF / ۲۰ logical CPU / ۳۲GiB و PostgreSQL16 در Docker؛ مقادیر Docker CPU/RAM دقیق در گزارش هر اجراست. محیط، رایانه توسعه است و آزمون‌های کوتاه مستقل در برخی بازه‌ها فعال بودند؛ تعهد سخت‌افزار production از این داده نتیجه‌گیری نمی‌شود.

| پروفایل | درخواست در steady پانزده دقیقه | read p95 | write p95 | خطای غیرمنتظره | نتیجه |
|---|---:|---:|---:|---:|---|
| ۳۰ اولیه | 13973 | 2337ms | 2965ms | صفر | رد معیار؛ گزارش حفظ شد |
| ۳۰ بهینه دوم | 16969 | 397ms | 1024ms | صفر | write بالاتر از هدف |
| ۳۰ نهایی | 18020 | 117ms | 146ms | صفر | موفق؛ ۳۰ اتصال برقرار |
| ۱۰۰ ازسرگرفته | 59816 | 140ms | 328ms | صفر | موفق؛ ۱۰۰ اتصال برقرار |
| ۳۰۰ | متوقف به درخواست کاربر | — | — | — | به مرحله آخر توسعه منتقل شد؛ نتیجه معتبر ندارد |

پروفایل ۱۰۰ قبلی با خاموشی محیط قطع و فایل آن خالی ماند؛ نتیجه قبولی ندارد. ۱۰۰ جدید با warm-up120s و steady900s، 53845 پاسخ200 و5971 پاسخ201 و realtime p95=1136ms ثبت شد. هر گزارش fingerprint سورس زمان آغاز خودش را دارد؛ اصلاح policy مهمان و هدر ضبط پس از آغاز ۱۰۰ انجام شد و پروفایل بعدی از نسخه تازه اجرا می‌شود.

## محدودیت پذیرش

image تجاری قبلی وجود نداشت؛ upgrade Compose از fixture سازگار schema018 به019 است و به معنای آزمایش binary قبلی فروخته‌شده نیست. restart container آزموده شده، reboot فیزیکی رایانه مشتری انجام نشده است. TLS عمومی/DNS، پرداخت/SMTP واقعی، نام و قیمت نهایی، legal approval و SLA به تنظیمات ناشر وابسته‌اند. اصل داده و source archive محفوظ‌اند؛ dry-run فایل واقعی یک JPEG معتبر دارد و ORGANIZATION_MAPPING_REQUIRED مانع import به مقصد حدسی است.

بسته آفلاین نسخه توسعه 0.1.0 در .tmp/releases/0.1.0-dev-20261014 ساخته شد. نصب‌کننده و اصلاح maintenance ابزار ارتقا افزوده شدند؛ آزمون‌های اختصاصی این تغییرات هنوز اجرا نشده‌اند. به درخواست کاربر، اجرای آزمون‌های بیشتر، بررسی نهایی بسته و آزمون بار به مرحله آخر توسعه منتقل شدند. اجرای ۳۰۰ کاربر متوقف شد و نتیجه پذیرش ندارد. هیچ انتشار عمومی یا استفاده از داده مشتری برای demo انجام نشده است.

تقویم ماهانه و تغییر ماه، بازکردن تسک، RTL در ۳۶۰/۱۴۴۰، تقویم Gregorian سازمان و تاریخ-only در America/Los_Angeles آزموده شدند. فراخوانی تاریخ رویداد با timezone سازمان و موعد/date با UTC انجام می‌شود تا روز موعد جابه‌جا نشود. پاسخ API no-store است. آزمون onboarding در یک اجرای تعویض حالت fixture به timeout فرم خورد؛ اجرای مجدد موفق بود و readiness fixture اکنون deploymentMode تازه را هم کنترل می‌کند.
