# ADR 005 — مهاجرت قابل بازبینی

وضعیت: ورودی JSON و fixture آزموده شده؛ backfill/فایل واقعی باقی است.

dry-run مرجع داده اصلی را نمی‌نویسد و `readStore()` قدیمی را فراخوانی نمی‌کند؛ آن تابع قبلاً داده را normalize و حتی در خطای parse جایگزین می‌کرد. رفتار جایگزینی فایل خراب نیز حذف شد.

Apply فقط به دیتابیس کاملاً خالی، با transaction و advisory lock، کپی immutable منبع و checksum ledger انجام می‌شود. retry ورودی یکسان بی‌اثر است. ورودی متفاوت روی مقصد غیرخالی رد می‌شود؛ ارتقای schema با migrate deploy مستقل است.

projectId مقدم است. projectName فقط با یک تطابق یکتا نگاشت می‌شود؛ نام تکراری mapping صریح taskId→projectId می‌خواهد. پول به‌صورت رشته Decimal تبدیل می‌شود. ساختار مالی ownerId→userId از repository موجود استخراج شده است.

تمام ورودی در MigrationImport.sourceSnapshot آرشیو می‌شود تا فیلدهای هنوز بدون mapping عملیاتی دور ریخته نشوند. آرشیو و کپی منبع اطلاعات حساس دارند و backup خصوصی محسوب می‌شوند. archive مرجع عملیات روزمره نیست. migration کامل و lossless فایل‌ها/همه فیلدها هنوز تأیید نشده است.
