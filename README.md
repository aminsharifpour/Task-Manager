# مدیریت پروژه شکف

هسته مشترک مدیریت پروژه برای میزبانی چند سازمان و نصب مستقل مشتری. نام محصول در PRODUCT_NAME تنظیم می‌شود. پروژه بر اساس CODEX_IMPLEMENTATION_BRIEF_FA.md توسعه یافته و برند/فونت از مرجع Shekoflow هماهنگ شده است.

- [وضعیت توسعه](docs/IMPLEMENTATION_STATUS.md)
- [دامنه محصول](docs/PRODUCT_SCOPE.md)
- [نصب محلی و self-hosted](docs/SELF_HOSTED.md)
- [میزبانی](docs/HOSTED.md)
- [backup و restore](docs/BACKUP_RESTORE.md)
- [ارتقا](docs/UPGRADE.md)
- [معماری](docs/ARCHITECTURE.md)
- [آزمون‌ها و شواهد](docs/VALIDATION_REPORT.md)

## بررسی همین نسخه

برای نصب بسته آفلاین، Node.js 22 و Docker/Compose v2 روی میزبان لازم‌اند؛ نصب وابستگی npm روی مقصد لازم نیست. فایل نمونه `deploy/release.env.example` را به محل خصوصی خارج بسته کپی و تکمیل کنید، سپس از پوشه بسته `node scripts/compose-install.mjs --project shekof --env-file /secure/release.env` را اجرا کنید. مسیر نصب و تنظیم TLS در SELF_HOSTED.md آمده است. فرمان‌های npm پایین مربوط به سورس پروژه‌اند.

Node.js 22 و Docker/PostgreSQL لازم‌اند. نصب وابستگی و generate: `npm ci` و `npm run prisma:generate`. برای gates، TEST_DATABASE_URL باید به دیتابیس جدا دارای پسوند `_test` اشاره کند؛ آزمون‌ها schema یکتای خود را می‌سازند و پاک می‌کنند. Chrome با PLAYWRIGHT_EXECUTABLE_PATH قابل تنظیم است.

`npm run verify:launch` بررسی syntax، types، build، smoke، سیاست‌ها، migration، APIهای PostgreSQL و مرورگر را اجرا می‌کند. `npm run test:s3` و `npm run test:release` fixtures Docker خصوصی خود را دارند. `test:load` برای هر پروفایل ۳۰/۱۰۰/۳۰۰ حداقل یک دقیقه warm-up و پانزده دقیقه steady state دارد؛ نتیجه واقعی در فایل گزارش مستقل نوشته می‌شود. آزمون بار جای تعهد ظرفیت تجاری نیست.

پیش‌نمایش این رایانه: `docker start shekof-foundation-local` سپس `npm run review:foundation`؛ نشانی http://127.0.0.1:8896/app/organizations. جزئیات داده مصنوعی در SELF_HOSTED.md است.

فایل اصلی JSON و `.env` موجود حفظ شده‌اند. JSON فقط مسیر توسعه قدیمی است؛ production PostgreSQL/foundation را اجباری می‌کند. endpointهای قدیمی بدون مرز سازمان در حالت جدید بسته‌اند. انتقال واقعی داده نیاز به mapping/dry-run/backup مستقل دارد و به پیش‌نمایش مصنوعی انجام نشده است.
