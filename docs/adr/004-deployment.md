# ADR 004 — یک هسته، دو مدل استقرار

وضعیت: اجراشده، ۲۰۲۶-۱۰-۱۴.

DEPLOYMENT_MODE=hosted|self_hosted از یک code/image استفاده می‌کند. hosted signup سازمان و self_hosted setup یک‌بار دارد؛ پذیرش دعوت در هر دو ممکن است. production به PostgreSQL/foundation/secret خصوصی نیاز دارد؛ JSON توسعه-only است.

وب و API در یک image سازگار ساخته می‌شوند. Compose شامل PostgreSQL خصوصی، migration یک‌باره مستقل، API غیر root و Caddy TLS/WebSocket است. API به موفقیت migration وابسته است و در startup خود schema/import را تغییر نمی‌دهد. public metadata در API تولید می‌شود تا static HTML اولیه noindex نامناسب نداشته باشد.

offline release imageها و manifest/checksum می‌دهد. نصب تمیز، restart container و restore مستقل واقعی آزموده شده‌اند. upgrade schema 018 به 019 با backup پیشین آزموده شده؛ binary یک release تجاری قبلی وجود ندارد. reboot فیزیکی میزبان و DNS/TLS عمومی نیازمند پذیرش در زیرساخت مقصد هستند و روی رایانه کاربر اجرا نشده‌اند.
