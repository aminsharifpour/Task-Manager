# ADR 001 — مرز سازمان

وضعیت: scope، permission و قیود اجرا و آزموده، ۲۰۲۶-۱۰-۱۴.

Organization مستقل از Team است. User مشترک و نقش/وضعیت/مجوز حساس متعلق به OrganizationMembership است. context سرور عضویت فعال را مرجع قرار می‌دهد. مهمان grant صریح دارد. scope اجباری و FK مرکب از ارتباط بین سازمان‌ها جلوگیری می‌کند؛ CRUD/count/search/export/socket/files/notification/audit آزمون جدا دارند.

RLS به‌عنوان دفاع تکمیلی ارزیابی شد، ولی در این release فعال نیست. مدل هویت و عملیات اپراتور global و مدل محتوایی scoped است؛ context پایگاه باید با SET LOCAL داخل transaction و role فاقد BYPASSRLS در هر مسیر pool اعمال شود. فعال‌سازی ناقص روی owner role یا باقی‌گذاشتن session context در pool، دفاع واقعی نیست. فعلاً service context، lock عضویت، select محدود، FK و gates جداسازی مرجع اجرا هستند. فعال‌سازی RLS نیاز به migration/policy و role پایگاه مستقل همراه regression کامل دارد، نه تنظیم ظاهری یک flag.

routerهای legacy فاقد scope و Socket قدیمی در foundation بسته‌اند. دو replica با outbox/receipt و rate counter مشترک آزموده شده‌اند؛ local storage چندمیزبانی نیاز به volume مشترک سازگار یا S3 دارد. ظرفیت هم‌زمان فقط از گزارش بار همان پروفایل نتیجه‌گیری می‌شود.
