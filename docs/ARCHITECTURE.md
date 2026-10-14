# معماری اجراشده

modular monolith با namespaceهای organizations، projects/tasks، files، chat، teams، minutes، HR، accounting، notifications، accounts، operations و marketing. runtime production PostgreSQL و tenant foundation را اجباری می‌کند. JSON و routerهای قدیمی فقط برای توسعه باقی‌اند؛ API/Socket/download قدیمی در foundation محتوا عرضه نمی‌کنند.

User هویت مشترک و OrganizationMembership مرجع نقش/وضعیت و مجوز مستقل HR/مالی است. orgId از context سمت سرور می‌آید. FK مرکب و scope اجباری از رابطه بین سازمان‌ها جلوگیری می‌کند. پروژه/تسک، count/search/export و دانلود همان مجوزهای نقش/assignee/grant را بررسی می‌کنند. mutation قفل ردیف سازمان و عضویت تازه دارد؛ خواندن‌های هسته/گزارش و chunk خروجی با قفل shared و context تازه انجام می‌شوند. پول با Decimal و واحد صریح، زمان با دقیقه صحیح و تاریخ با timezone/calendar سازمان مدیریت می‌شود.

Task دارای version، snapshot گردش‌کار، pending assignee و event/receipt تصمیم است. active workflow از تغییر قالب جداست. checklist/parent/dependency با کنترل چرخه و تکمیل مرتبط‌اند. queryهای فهرست و داشبورد محدود/aggregate هستند؛ index و EXPLAIN ANALYZE در گزارش بار ثبت می‌شوند. می‌توان template و فیلدها را بدون تخریب قرارداد تسک‌های موجود تغییر داد.

فایل immutable با کلید hash سازمان/UUID/UUID و checksum SHA256 است. metadata و version/review/feedback/link در DB و بایت در local volume یا S3 هستند. quota در transaction همه نسخه‌ها را حساب می‌کند. دانلود عمومی یا dataURL فایل قدیمی در DTO عرضه نمی‌شود. legacy apply ledger و snapshot/backups واقعی دارد؛ retry آن idempotent و mapping نادرست رد است. reconciliation مرجع DB را حفظ و orphan را فقط با دستور صریح و قفل پاک می‌کند.

AuthSession مستقل از claim نقش JWT است؛ ورود، خروج، رمز و membership revoke در DB بررسی می‌شوند. rate counter پایگاه مشترک است. realtime outbox روی audit/notification در transaction تولید و receipt هر instance پس از بررسی scope ثبت می‌شود. گیرنده session/عضویت/منبع تازه دارد؛ payload فقط invalidation/شناسه منبع است. presence lease و typing TTLدارند. heartbeat به‌صورت دسته‌ای هر سازمان اجرا می‌شود و پیام خصوصی به سازمان دیگر نمی‌رود.

product-root config بدون secret را می‌خواند و مسیر عمومی، onboarding و فضای کار را lazy-load می‌کند. تغییر سازمان request قبلی را abort و state را پاک می‌کند. صفحات ماژول lazy هستند. فرم‌های ویرایش scalar از refresh اعلان زنده محافظت شده‌اند؛ version conflict از overwrite داده سرور جلوگیری می‌کند. فونت محلی IRANYekan و توکن‌های مرجع Shekoflow مشترک‌اند. لندینگ chunk فضای کار را دانلود نمی‌کند و metadata آن قبل از JavaScript در HTML تولید می‌شود.

image واحد شامل web و API/Prisma سازگار است. Caddy TLS و WebSocket را proxy می‌کند؛ پایگاه/API پورت عمومی ندارند. migrate سرویس یک‌باره و API غیر root است. ابزارهای backup، restore خالی، upgrade با maintenance و بسته offline مستقل‌اند. metric داخلی با token جدا فقط دسته‌های ثابت و شمارنده‌ها را می‌دهد؛ telemetry بیرونی پیش‌فرض خاموش است. توسعه UI polish و تصمیم تجاری از ادعای ظرفیت و پذیرش عملیات جدا ثبت می‌شوند.
