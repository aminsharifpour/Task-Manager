# برنامه مهاجرت امن به HeroUI v3

## وضعیت فعلی
- این پروژه اکنون روی `React 18.3.1` است.
- این پروژه اکنون روی `Tailwind CSS 3.4.17` است.
- UI فعلی heavily روی `Radix` و primitiveهای سفارشی بنا شده است.

## Constraint رسمی HeroUI v3
بر اساس peer dependency واقعی `@heroui/react@3.0.2`:
- `react >= 19.0.0`
- `react-dom >= 19.0.0`
- `tailwindcss >= 4.0.0`

نتیجه:
- نصب مستقیم HeroUI v3 روی وضعیت فعلی پروژه امن نیست.
- مسیر درست، مهاجرت مرحله‌ای پایه فرانت و سپس integration تدریجی HeroUI است.

## هدف
ورود HeroUI v3 بدون شکستن shell فعلی، بدون big-bang replacement، و با امکان rollback مرحله‌ای.

## فاز 0: Audit و Gate
### خروجی
- اسکریپت readiness:
  - `npm run audit:heroui3`

### Gate
- تا وقتی audit blocker می‌دهد، نصب HeroUI v3 انجام نشود.

## فاز 1: Migration پایه
### کارها
1. ارتقای React:
   - `react`
   - `react-dom`
   - `@types/react`
   - `@types/react-dom`

2. مهاجرت Tailwind v3 به v4:
   - CSS entry از `@tailwind ...` به `@import "tailwindcss";`
   - PostCSS از `tailwindcss` به `@tailwindcss/postcss`
   - بازبینی pluginها و config فعلی

3. Re-validate:
   - `npx tsc -p apps/web/tsconfig.json --noEmit`
   - `npm run build --silent`
   - smoke test روی:
     - `dashboard`
     - `tasks`
     - `chat`
     - `accounting`

### ریسک
- Tailwind v4 می‌تواند روی tokenها و utilityهای custom فعلی اثر بگذارد.
- React 19 می‌تواند primitiveهای Radix را در بعضی مسیرها حساس کند.

## فاز 2: نصب HeroUI v3
### کارها
1. نصب:
   - `@heroui/react`
   - `@heroui/theme` یا style package متناظر اگر لازم بود

2. اضافه‌کردن Provider در shell
3. بدون جایگزینی سراسری، فقط prove-out محدود

### محدوده prove-out
- `Button`
- `Input`
- `Textarea`
- `Modal/Dialog shell`

### ریسک
- اگر از همان ابتدا `Select`, `Popover`, `Table` را migrate کنیم، regression سطح بالا می‌رود.

## فاز 3: Integration تدریجی
### اولویت مهاجرت primitiveها
1. `button`
2. `input`
3. `textarea`
4. `modal shell`
5. `card shell`
6. `tabs`

### primitiveهایی که فعلا باید نگه داشته شوند
- `Select`
- `Popover`
- `Table`
- `Context menu`

این‌ها باید فقط بعد از گذر موفق فازهای قبلی بررسی شوند.

## فاز 4: Design System Consolidation
### کارها
- نگاشت tokenهای فعلی به tokenهای HeroUI
- حذف primitiveهای تکراری
- کاهش divergence بین:
  - `One UI-like shell`
  - `HeroUI components`

## تعریف موفقیت
مهاجرت موفق است اگر:
1. build و typecheck پایدار بمانند
2. shell اصلی regression نداشته باشد
3. حداقل 4 primitive اصلی با HeroUI جایگزین شوند
4. `tasks`, `chat`, `notifications` بدون شکست رفتاری باقی بمانند

## تعریف شکست
اگر یکی از این موارد رخ دهد، migration باید متوقف و rollback شود:
1. loopهای React یا runtime instability
2. شکستن Tailwind tokenها در shell
3. degrade محسوس در فرم‌ها و دیالوگ‌ها
4. conflict ساختاری بین HeroUI و Radix در مسیرهای پرتکرار

## تصمیم فعلی
بهترین و امن‌ترین مسیر:
1. اجرای `audit:heroui3`
2. مهاجرت React 19 + Tailwind 4
3. بعد نصب HeroUI v3
4. بعد integration محدود و کنترل‌شده
