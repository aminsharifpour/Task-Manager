# ADR 003 — فایل خصوصی و immutable

وضعیت: local و S3-compatible اجرا و آزموده، ۲۰۲۶-۱۰-۱۴.

نام فایل metadata است؛ کلید فقط hash سازمان/UUID فایل/UUID نسخه است. adapter شامل put/get/remove/list/health است. هر نسخه immutable و با byteSize/SHA256 ذخیره می‌شود. دانلود API عضویت و منبع را دوباره بررسی می‌کند؛ URL عمومی ساخته نمی‌شود. S3 در production فقط HTTPS و write شرطی IfNoneMatch دارد.

metadata/version/feedback/review/link در PostgreSQL است. quota تراکنشی همه task/chat/minute نسخه‌ها و بایگانی را حساب می‌کند. archive/delete پیام فایل را پاک نمی‌کند. retry با receipt/hash کنترل می‌شود؛ commit مبهم باعث حذف blind object نمی‌شود.

reconciliation metadata را با object تطبیق می‌دهد؛ referenced file هرگز حذف نمی‌شود. orphan فقط با دستور صریح، حداقل هفت روز سن، سازمان شناخته‌شده، قفل و کنترل دوباره مرجع پاک می‌شود. snapshot DB/blob/config باید با توقف همه writerها سازگار باشد. local Compose backup/restore و S3 snapshot به prefix خالی با checksum و pairing dump واقعاً آزموده شده‌اند؛ RPO/RTO تجاری از آنها نتیجه‌گیری نمی‌شود.

legacy file planner بدون تغییر منبع محتوا/نوع/path/hash را کنترل می‌کند. apply نگاشت صریح، snapshot منبع، backups immutable و ledger idempotent دارد. این عملیات فقط روی fixture مصنوعی آزموده شده و روی JSON اصلی اعمال نشده است.
