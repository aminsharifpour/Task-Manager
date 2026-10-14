# میزبانی چند سازمان

به‌روز: ۲۰۲۶-۱۰-۱۴. همین image/Compose با DEPLOYMENT_MODE=hosted کار می‌کند. هویت مشترک، عضویت و نقش هر سازمان مستقل‌اند؛ HR و مالی مجوز مستقل دارند. signup سازمان تازه، پذیرش دعوت، نشست‌ها و تغییر رمز پیاده و آزموده شده‌اند. هر مهمان برای مشاهده پروژه نیاز به دسترسی صریح دارد.

JWT_SECRET و credential پایگاه خصوصی، PUBLIC_SITE_URL واقعی HTTPS، دامنه در Caddyfile.public و CORS در استقرار جداگانه باید تنظیم شوند. PUBLIC_LEADS_ENABLED و MARKETING_INDEX_ENABLED را فقط در نصب عمومی موردنظر فعال کنید؛ صفحه خصوصی و متن حقوقی تأییدنشده noindex باقی می‌ماند. PRODUCT_NAME، PRODUCT_DESCRIPTION، PUBLIC_CONTACT_EMAIL و متن‌های LEGAL_* تنظیم‌پذیر هستند. متن حقوقی پیش‌فرض پیش‌نویس است.

PLATFORM_OPERATOR_USER_IDS فقط شناسه اپراتورهای مجاز را مشخص می‌کند. اپراتور به ظرفیت و طرح دستی و درخواست‌های معرفی محصول دسترسی دارد؛ این نقش، دسترسی به محتوای سازمان ایجاد نمی‌کند. فعال‌سازی قابلیت و حد عضو/فضا audit می‌شود. درگاه پرداخت پیش‌فرض غیرفعال است؛ بدون انتخاب ارائه‌دهنده و مشخصات واقعی، پرداخت، قیمت یا ارسال ایمیل جعل نشده است.

Realtime از outbox تراکنشی PostgreSQL و receipt مستقل هر replica استفاده می‌کند. آزمون دو replica، حضور، تایپ، لغو عضویت/نشست و جلوگیری از پیام خصوصی بین سازمان‌ها موفق است. load balancing باید WebSocket را عبور دهد؛ front-end از transport WebSocket استفاده می‌کند. counterهای rate limit در PostgreSQL مشترک‌اند. فایل‌ها روی local volume یا S3-compatible خصوصی هستند. در production اتصال S3 فقط HTTPS مجاز است؛ credential از secret خصوصی یا chain استاندارد AWS خوانده می‌شود. در Compose FILE_STORAGE_DRIVER=s3 و S3_* را مشخص کنید. در این حالت از روش backup هماهنگ S3 استفاده کنید؛ اسکریپت volume backup صریحاً این driver را رد می‌کند.

METRICS_TOKEN اختیاری و حداقل ۳۲ کاراکتر است. `/api/metrics` با Bearer token خصوصی، histogram مدت پاسخ و خطاهای poll زنده و حافظه process می‌دهد. labelها فقط دسته ثابت مسیر و کلاس HTTP هستند؛ نام سازمان، شناسه کاربر، query، محتوا و secret در metric قرار نمی‌گیرند. نبود token این endpoint را می‌بندد. telemetry خارجی پیش‌فرض غیرفعال است.

ظرفیت وعده تجاری نیست. گزارش‌های واقعی در `docs/validation/load-*.json` شامل سخت‌افزار، تعداد داده، زمان فکر، warm-up، پانزده دقیقه steady state و خطاها هستند. نتایج هر پروفایل جدا گزارش می‌شوند؛ نتیجه ۳۰ کاربر اثبات ظرفیت ۳۰۰ کاربر نیست.

PRODUCT_LOGO_PATH می‌تواند به SVG/PNG/WebP محلی زیر /images یا /branding اشاره کند؛ asset باید همراه public bundle ساخته شود. بدون تنظیم، نشان مشترک Sparkles از مرجع Shekoflow استفاده می‌شود. پایه پیام‌های navigation فارسی در workspace/messages.ts جدا شده است؛ زبان دوم به‌عنوان قابلیت کامل عرضه نمی‌شود.
