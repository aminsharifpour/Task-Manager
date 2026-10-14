# فایل، مهاجرت و ذخیره‌سازی ـ وضعیت توسعه

دو adapter خصوصی وجود دارد: `local` و `s3`. همه دانلودها از API سازمان و پس از بررسی مجوز/اندازه/SHA256 انجام می‌شوند؛ URL عمومی یا کلید storage در DTO وجود ندارد. پیوست تسک/گفتگو/صورت‌جلسه و نسخه‌های بایگانی‌شده در یک quota سازمان حساب می‌شوند.

## پیکربندی S3

`FILE_STORAGE_DRIVER=s3`، `S3_BUCKET`، `S3_REGION`؛ برای سرویس سازگار: `S3_ENDPOINT` و `S3_FORCE_PATH_STYLE=true`. `S3_PREFIX` پیش‌فرض workspace است. زوج `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` یا credential provider استاندارد AWS در سرور، هرگز مرورگر. endpoint production باید HTTPS باشد. bucket باید خصوصی باشد و دسترسی GET/PUT/DELETE/List/Head فقط برای سرور مجاز باشد. از حساب root سرویس storage در production استفاده نشود. head bucket در readiness واقعی بررسی می‌شود.

put از شرط `If-None-Match: *` استفاده می‌کند تا شیء موجود overwrite نشود؛ بدون پشتیبانی واقعی این شرط، backend قابل قبول نیست. مبنا: [AWS conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)، [AWS SDK v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/).

`npm run test:s3` روی container آزمایشی مستقل RustFS و image digest ثابت اجرا شد: نوشتن شرطی/دانلود/اندازه/کلید/فهرست/حذف موفق. این آزمون تأیید همه ارائه‌دهندگان S3 نیست. image آزمایشی پیشنهاد استقرار تجاری نیست؛ نصب بسته محصول به S3 اجباری وابسته نیست.

## انتقال فایل قدیمی

ابتدا داده JSON با migration دارای نگاشت صریح وارد PostgreSQL شود. sourceSnapshot در MigrationImport باید دقیقاً با منبع مطابقت داشته باشد. `files:plan-legacy` manifest فقط‌خواندنی ایجاد می‌کند. بعد `files:apply-legacy -- --apply --source <JSON> --uploads <ROOT> --organization-id <ID> --manifest <REPORT> --backup-dir <EXISTING_DIR>`.

هر مقصد قبل از اولین نوشتن با شناسه پیام، سازمان، گفتگو، فرستنده و attachment خام تطبیق داده می‌شود. منبع و هر blob در backup با exclusive create/checksum نگهداری می‌شوند. raw attachment حذف نمی‌شود؛ ledger نسخه‌دار و فلگ migration، نمایش را به فایل خصوصی متصل می‌کنند. اجرای مجدد ایمن و هر پیام اتمیک است. قطع بین پیام‌ها ممکن است پیشرفت جزئی بسازد؛ اجرای مجدد ادامه می‌دهد. قطع DB یا خطای نوشتن، blob staging را برای reconciliation نگه می‌دارد. این import روی داده واقعی پروژه انجام نشده است.

## تطبیق و نگهداری

`files:reconcile -- --report <NEW_REPORT>` تمام metadata تسک/گفتگو/صورت‌جلسه و اشیای storage را بررسی می‌کند: missing، checksum خراب، orphan و نام ناشناخته. پیش‌فرض فقط گزارش است. `--apply-orphan-cleanup` تنها کلید معتبرِ بی‌مرجع، متعلق به سازمان موجود و دارای سن حداقل هفت روز را پس از قفل همان سازمان و بررسی دوباره حذف می‌کند. نسخه، بازخورد، metadata و فایل دارای مرجع حذف نمی‌شوند. نام ناشناخته و مسیر symlink پاک‌سازی نمی‌شود.

سیاست پیش‌فرض نگهداری نسخه‌های بایگانی‌شده نامحدود است و quota آن‌ها حفظ می‌شود. purge خودکار داده مرتبط فعال نیست؛ مدت تجاری/حقوقی حذف حدس زده نمی‌شود. حذف حساب/سازمان به معنای پاک‌کردن خودکار history نیست. backup metadata و blob باید پیش از هر سیاست purge آینده حفظ شود.

## قرارداد backup

برای local: PostgreSQL و کل volume private-files و archive منبع با یک نقطه سازگار (وقفه write یا snapshot هماهنگ) و manifest SHA256. برای S3: همان dump پایگاه‌داده به‌اضافه نسخه/کپی تمام کلیدهای metadata در prefix خصوصی و checksum؛ صرف versioning یا replication، backup دیتابیس نیست. restore باید DB و همان مجموعه blob را به namespace/bucket مستقل برگرداند، سپس reconciliation بدون apply و دانلود واقعی را بررسی کند. backup کل سرور با export یک سازمان متفاوت است.
