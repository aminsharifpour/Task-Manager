# ارتقا و سازگاری

به‌روز: ۲۰۲۶-۱۰-۱۴. نوزده migration نسخه‌دار وجود دارد؛ دستور Prisma deploy در سرویس یک‌باره migrate اجرا می‌شود. هر API replica به پایان موفق migrate وابسته است. مهاجرت با startup خود API اجرا نمی‌شود.

ابتدا release جدید و imageهای آن را در محیط جدا بررسی و روی میزبان مقصد load کنید. پیش از ارتقا، فضای کافی برای backup، نگهداری کلیدها و امکان restore مستقل لازم است. فرمان زیر برای نصب local storage است:

`node scripts/compose-upgrade.mjs --project shekof --env-file /secure/release.env --image shekof-app:0.1.0 --backup /new/pre-upgrade-backup`

این ابزار image موجود را کنترل، gateway را متوقف، backup هماهنگ DB/files/config می‌گیرد، API را متوقف و APP_IMAGE را در فایل env خصوصی عوض می‌کند. سپس migrate یک‌بار و API/gateway سالم را راه‌اندازی می‌کند. خطای migration با برگشت خودکار image پنهان نمی‌شود: نصب تا بررسی schema باید در maintenance بماند. در استقرار S3 از قرارداد dump/object-snapshot و کنترل همه replicaها استفاده کنید؛ این ابزار عمداً backup volume ناقص برای S3 نمی‌سازد.

backward compatibility یا rollback از تعویض tag استنتاج نمی‌شود. برگشت schema مخرب نیاز به forward repair یا restore هماهنگ پایگاه/blob/config دارد. restore ابزار فقط پروژه جدید و خالی را می‌پذیرد؛ بعد از بررسی داده و ورود/فایل، cutover واقعی یک تصمیم عملیاتی جداست. migrationهای 012..019 additive هستند، اما routeهای بنیاد سازمان و نشست جدید با کلاینت قدیمی بدون scope سازگار نیستند؛ UI و API یک image واحد دارند.

آزمون PostgreSQL غیرخالی از schema قدیمی، backfill با حفظ شناسه، رابطه، نظر، پیام، Decimal و اجرای دوباره را بررسی می‌کند. آزمون Compose برای ارتقای schema 018 به 019 و restore backup پیش از ارتقا نوشته شده است؛ نتیجه اجرای واقعی در validation/release-compose.json ثبت می‌شود. fixture schema قبلی با همین API سازگار index-only ساخته می‌شود؛ این آزمایش به معنای امتحان binary یک release تجاری قبلی نیست، چون چنین releaseی در این پروژه وجود ندارد.

baseline دیتابیس ساخته‌شده قبلاً با db push باید با schema واقعی تطبیق و migration نخست به‌صورت صریح resolve شود. این کار روی دیتابیس اصلی کاربر اجرا نشده است. custom SQL constraintها، scoped FKها و checkها باید در migrationهای بعد حفظ شوند؛ Prisma schema به‌تنهایی همه آنها را نشان نمی‌دهد. تغییر مدل نیاز به generate و توقف processهای دارای DLL Prisma در Windows دارد.

در خطای مرحله راه‌اندازی یا انتظار سلامت نیز ابزار دوباره gateway را متوقف می‌کند؛ ممکن است این سرویس پیش از شکست health wait روشن شده باشد. اگر توقف Docker ممکن نباشد، خروجی صریحاً توقف دستی درگاه را لازم اعلام می‌کند. این اصلاح در پذیرش نهایی بررسی خواهد شد.
