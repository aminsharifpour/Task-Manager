# نصب و اجرای مستقل

به‌روز: ۲۰۲۶-۱۰-۱۴. هسته PostgreSQL و رابط وب در یک image سازگار ساخته می‌شوند. Compose شامل PostgreSQL خصوصی، migration یک‌بار، API غیر root و درگاه Caddy است. تنها درگاه HTTP/HTTPS به میزبان متصل است. volumes پایگاه، فایل خصوصی و گواهی ماندگار هستند.

## نصب از سورس

Docker با Compose v2 و برای ابزارهای نگهداری Node.js 22 لازم است. روی checkout اصلی مشتری آزمون مصنوعی اجرا نکنید.

1. `docker build -t shekof-app:0.1.0 .`
2. از `deploy/release.env.example` یک فایل خصوصی خارج مخزن بسازید. POSTGRES_PASSWORD و JWT_SECRET دو مقدار مستقل تصادفی hexadecimal، هرکدام حداقل ۳۲ بایت باشند. فایل env را منتشر نکنید.
3. `docker compose --project-name shekof --env-file /secure/release.env up -d --wait`
4. پیش‌فرض، `https://localhost:8443/setup` است. رمز مالک را خودتان انتخاب کنید؛ پس از نخستین setup این مسیر بسته می‌شود. public signup در self_hosted بسته است، پذیرش دعوت مجاز است.

پیش‌فرض Caddy از CA داخلی استفاده می‌کند؛ CA نصب خود را روی مرورگرهای مجاز trust کنید. تست آزمایشگاهی فقط برای همین گواهی محلی verification را کنار می‌گذارد؛ کلاینت محصول چنین استثنایی ندارد. برای دامنه عمومی، SITE_ADDRESS و PUBLIC_SITE_URL، BIND_ADDRESS و پورت‌های ۸۰/۴۴۳ را تنظیم و CADDY_CONFIG را به `./deploy/Caddyfile.public` تغییر دهید. TLS عمومی نیازمند DNS و دسترسی واقعی درگاه است؛ این پروژه هیچ DNS یا سرویس زنده‌ای را خودکار تغییر نمی‌دهد.

برای شبکه بدون اینترنت بسته را با `npm run release:build -- --version 0.1.0 --output /new/release-dir` بسازید. مقصد باید جدید باشد. `release-manifest.json` شامل checksum فایل‌ها و شناسه imageها است. imageهای بسته با شناسه immutable ارجاع داده می‌شوند. معماری بسته باید با میزبان مقصد یکی باشد؛ این روش cross-build انجام نمی‌دهد.

روی میزبان مقصد Docker/Compose v2 و Node.js 22 را از پیش نصب کنید. وارد پوشه بسته شوید، `deploy/release.env.example` را به مسیری خصوصی خارج بسته کپی و secrets مستقل و تنظیمات واقعی را وارد کنید. سپس `node scripts/compose-install.mjs --project shekof --env-file /secure/release.env` را اجرا کنید. نصب‌کننده inventory/checksum، معماری Linux میزبان Docker، secrets و نبود container/volume قبلی برای نام پروژه را کنترل می‌کند، imageها را load و بدون pull از شبکه، migration و سرویس‌ها را اجرا می‌کند. این ابزار برای نصب تازه با local storage است؛ restore و upgrade ابزار مستقل دارند. secrets یا تصویر متفاوت در APP_IMAGE این نصب‌کننده پذیرفته نمی‌شود.

برای کنترل فقط‌خواندنی بسته: `node scripts/verify-release.mjs --directory /path/to/release`. checksum خرابی و کمبود فایل را تشخیص می‌دهد؛ اصالت ناشر به کانال تحویل مورداعتماد وابسته است و manifest امضای دیجیتال ندارد. فایل env خصوصی را داخل بسته قرار ندهید.

در env نصب، PUBLIC_SIGNUP_ENABLED فقط در hosted، JWT_EXPIRES_IN برای عمر نشست، PRODUCT_NAME/PRODUCT_LOGO_PATH/PRODUCT_DESCRIPTION برای برند، PUBLIC_CONTACT_EMAIL برای تماس و LEGAL_PRIVACY_TEXT/LEGAL_TERMS_TEXT/LEGAL_TEXT_APPROVED برای متن حقوقی تنظیم می‌شوند. لوگو باید asset محلی موجود در image باشد؛ تنظیم مسیر فایل، خود فایل را اضافه نمی‌کند. متن حقوقی تأییدنشده همچنان پیش‌نویس است.

## ادامه پیش‌نمایش همین رایانه

`docker start shekof-foundation-local` و `npm run review:foundation`، نسخه آزمایشی را در `http://127.0.0.1:8896/app/organizations` اجرا می‌کنند. PostgreSQL آزمایشی روی 56432 و schema جدا review_foundation است. کاربر 09000000200 و رمز Synthetic-Review-2026 صرفاً داده مصنوعی هستند. container قدیمی shekof-foundation-test همان volume را دارد و باید خاموش بماند. داده اصلی JSON به این پیش‌نمایش import نشده است.

## عملیات

`restart: unless-stopped` و healthcheck فعال‌اند؛ مهاجرت هر replica در startup اجرا نمی‌شود. آزمون `npm run test:release` نصب تمیز، TLS داخلی، راه‌اندازی مجدد container و بازیابی در پروژه جدید را بررسی می‌کند. خاموش/روشن‌کردن واقعی رایانه مشتری بدون درخواست مستقل انجام نمی‌شود. پشتیبان و ارتقا را مطابق BACKUP_RESTORE.md و UPGRADE.md اجرا کنید.
