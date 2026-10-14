# اجرای محلی و بسته استقرار

راهنمای جاری در [docs/SELF_HOSTED.md](docs/SELF_HOSTED.md) و [docs/HOSTED.md](docs/HOSTED.md) است. روش قدیمی JSON/development مبنای نصب production نیست.

روی همین رایانه برای پیش‌نمایش مصنوعی: `docker start shekof-foundation-local` سپس `npm run review:foundation`. نشانی: http://127.0.0.1:8896/app/organizations.

برای مشتری، image واحد وب/API، PostgreSQL خصوصی، migrate یک‌باره و Caddy TLS در docker-compose.yml استفاده می‌شوند. محیط واقعی و secrets در deploy/release.env.example فقط الگو هستند. خود فایل env اصلی پروژه تغییر نکرده است.
