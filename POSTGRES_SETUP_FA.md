# آماده‌سازی PostgreSQL برای پروژه

این پروژه الان برای PostgreSQL آماده شده، ولی هنوز runtime اصلی عمدا روی `json` مانده تا migration مرحله‌ای و بدون ریسک انجام شود.

## وضعیت فعلی
- ORM: `Prisma`
- schema: `apps/api/prisma/schema.prisma`
- Prisma client singleton: `apps/api/src/prisma.js`
- mode فعلی: `DB_MODE=json`

## فایل‌های env
- بک‌اند:
  - `.env.backend.example`
- فرانت:
  - `.env.frontend.example`

## متغیرهای لازم برای PostgreSQL
```env
DB_MODE=postgres
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/tasks_app?schema=public
```

## دستورات اصلی
1. تولید Prisma Client:
```bash
npm run prisma:generate
```

2. ساخت migration اولیه:
```bash
npm run prisma:migrate -- --name init
```

3. فقط sync schema بدون migration:
```bash
npm run prisma:push
```

4. باز کردن Prisma Studio:
```bash
npm run prisma:studio
```

5. انتقال داده‌های فعلی از JSON به PostgreSQL:
```bash
npm run db:migrate-json
```

## نکته مهم
تا وقتی migration لایه `store/json` به Prisma کامل نشده، `DB_MODE` را روی `json` نگه دار.

## وضعیت فعلی بک‌اند
- اگر `DB_MODE=postgres` باشد، بک‌اند در startup به PostgreSQL وصل می‌شود.
- وضعیت دیتابیس در `GET /api/health` هم برگردانده می‌شود.
- اگر PostgreSQL در دسترس نباشد، health خطای اتصال را نشان می‌دهد.

## گام بعدی
گام بعدی باید این باشد:
1. ساخت repository layer
2. پیاده‌سازی `DB_MODE=postgres` در endpointها
3. حذف تدریجی وابستگی مستقیم endpointها به `readStore/writeStore`
