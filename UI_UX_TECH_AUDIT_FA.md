# ارزیابی UI/UX و نقشه راه بازطراحی فرانت

تاریخ: 2026-03-31

## هدف
این سند برای دو چیز نوشته شده است:

1. مشخص کند کدام بخش‌های محصول از نظر تجربه کاربری و ظاهر بیشترین نیاز به ارتقا دارند.
2. مشخص کند کدام debtهای فنی در فرانت مستقیما کیفیت UX و سرعت توسعه را پایین آورده‌اند.

این سند مبنای اجرای فازهای بعدی است.

## جمع‌بندی اجرایی
وضعیت فعلی محصول از نظر دامنه قابلیت‌ها خوب است. مشکل اصلی دیگر «کمبود قابلیت» نیست؛ مشکل اصلی این است که:

- بعضی ماژول‌ها هنوز از نظر تراکم تعامل شلوغ‌اند.
- بعضی viewها از نظر فنی شکننده‌اند.
- الگوهای طراحی و state persistence در کل فرانت هنوز سخت‌گیر و استاندارد نشده‌اند.

اگر هدف، ارتقای واقعی ظاهر و کارآیی نرم‌افزار است، سه محور اصلی باید همزمان جلو بروند:

1. طراحی یک `Design System` عملیاتی
2. refactor ساختاری فرانت برای حذف debtهای پرهزینه
3. ساده‌سازی تعامل در صفحات پرتردد

## شواهد فنی

### فایل‌های بزرگ و پرریسک
- [App.tsx](/Users/aminsharifpour/Task1/apps/web/src/App.tsx): حدود `6132` خط
- [tasks-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/tasks-view.tsx): حدود `2079` خط
- [accounting-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/accounting-view.tsx): حدود `639` خط
- [dashboard-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/dashboard-view.tsx): حدود `492` خط
- [notifications-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/notifications-view.tsx): حدود `445` خط

### debtهای تایپی و نگهداشت
این فایل‌ها هنوز با `@ts-nocheck` یا `props: any` کار می‌کنند:

- [dashboard-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/dashboard-view.tsx)
- [chat-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/chat-view.tsx)
- [projects-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/projects-view.tsx)
- [calendar-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/calendar-view.tsx)
- [settings-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/settings-view.tsx)
- [minutes-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/minutes-view.tsx)
- [team-hr-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/team-hr-view.tsx)

### state persistence پراکنده
ترکیب زیادی از `localStorage` در بخش‌های مختلف استفاده شده است:

- [App.tsx](/Users/aminsharifpour/Task1/apps/web/src/App.tsx)
- [tasks-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/tasks-view.tsx)
- [dashboard-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/dashboard-view.tsx)
- [use-task-project-minute-ui-state.ts](/Users/aminsharifpour/Task1/apps/web/src/hooks/use-task-project-minute-ui-state.ts)

این الگو باعث می‌شود:

- رفتار UI قابل‌پیش‌بینی نباشد
- debug سخت‌تر شود
- توسعه بعدی هزینه بیشتری داشته باشد

## ارزیابی ماژول‌به‌ماژول

### 1. Shell و ناوبری
وضعیت:
- shell کلی خوب شده
- سایدبار collapse/extended قابل‌استفاده است
- موبایل هم navigation مستقل دارد

مسئله:
- منطق shell هنوز زیادی در [App.tsx](/Users/aminsharifpour/Task1/apps/web/src/App.tsx) جمع شده
- popoverها و persistenceها هنوز از یک قرارداد واحد تبعیت نمی‌کنند

پیشنهاد:
- ساخت `ShellState` یا `UIPreferencesStore`
- انتقال همه stateهای مربوط به shell به یک نقطه واحد
- تعریف `Page Layout Contract` برای همه صفحات

### 2. داشبورد
وضعیت:
- `Today Command Center` اضافه شده و ارزش بالایی دارد

مسئله:
- مرز بین dashboard تحلیلی و dashboard عملیاتی هنوز کامل روشن نیست
- KPIها و laneها گاهی همزمان برای جلب توجه رقابت می‌کنند

پیشنهاد:
- کاهش تعداد KPIهای اولیه
- اولویت دادن به laneهای actionable
- تعریف 2 mode مشخص:
  - `Overview`
  - `Today Command Center`

### 3. تسک‌ها
وضعیت:
- بیشترین سرمایه UX روی این ماژول خرج شده
- گانت، ورک‌فلو، persistence و card layout وجود دارد

مسئله:
- هنوز از نظر فنی بیش از حد متمرکز است
- [tasks-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/tasks-view.tsx) نقش چند ماژول را همزمان بازی می‌کند
- هر تغییر جدید در این فایل، ریسک regression بالا دارد

پیشنهاد:
- شکستن به feature sliceهای جدا:
  - `tasks-toolbar`
  - `task-card-grid`
  - `task-detail-dialog`
  - `gantt-submodule`
  - `workflow-visualizer`
  - `task-create-edit-form`

### 4. پروژه‌ها
وضعیت:
- ظاهر بهتر شده
- فرم‌ها سکشن‌بندی شده‌اند

مسئله:
- هنوز با `@ts-nocheck` و `props: any` جلو می‌رود
- از نظر ساختار، یک قدم عقب‌تر از تسک‌هاست

پیشنهاد:
- تایپ‌دار کردن کامل props
- جدا کردن فرم‌ها و list cardها
- آوردن workflow summary به یک component مستقل

### 5. گفتگو
وضعیت:
- UI بهتر شده
- گروه، منشن، mute و جزئیات دارید

مسئله:
- این ماژول از نظر runtime قبلا ناپایدار بوده و هنوز debt فنی دارد
- هنوز `@ts-nocheck` دارد

پیشنهاد:
- اولویت بالا برای type-safe کردن
- جدا کردن:
  - conversation list
  - message timeline
  - composer
  - group management

### 6. مرکز اعلان
وضعیت:
- از نظر قابلیت، خوب و نسبتا کامل است

مسئله:
- هنوز کمی cognitive load بالا دارد
- فیلترها و preferenceها در یک صفحه همزمان به کاربر فشار وارد می‌کنند

پیشنهاد:
- default mode را تصمیم‌محور کنید:
  - `نیازمند اقدام`
  - `خوانده‌نشده`
  - `همه`
- preferenceها را به drawer یا panel ثانویه ببرید

### 7. حسابداری
وضعیت:
- ظاهر بهتر شده
- cardهای حساب‌ها و summaryها خوب‌تر شده‌اند

مسئله:
- برخی interactionها هنوز فرم‌محور و متراکم‌اند
- ساختار view هنوز با `props: any` اداره می‌شود

پیشنهاد:
- تعریف `account card pattern`
- جدا کردن toolbar، transaction filters و reports
- نمایش دائم `موجودی هر حساب` و `تغییرات اخیر` به‌عنوان primary information

### 8. HR
وضعیت:
- هم‌زبانی بصری با بقیه بیشتر شده

مسئله:
- data density هنوز بالاست
- مسیرهای پرونده پرسنلی، حضور و غیاب و مرخصی هنوز به‌لحاظ تمرکز UX کاملا تفکیک نشده‌اند

پیشنهاد:
- tabهای روشن‌تر برای:
  - `پروفایل`
  - `مرخصی`
  - `حضور و غیاب`
  - `گزارش`

## مهم‌ترین مسائل UX

### A. نبود قرارداد سراسری برای layout صفحه
هر صفحه الگویی نزدیک به هم دارد، اما هنوز قرارداد سخت‌گیر وجود ندارد.

باید استاندارد شود:
- hero/header
- toolbar
- content area
- summary area
- side actions

### B. تراکم تعاملی بالا
بعضی صفحات دکمه، فیلتر و action زیادی را همزمان به کاربر نشان می‌دهند.

قاعده پیشنهادی:
- 1 action اصلی
- 2 یا 3 action ثانویه
- بقیه داخل context menu یا panel ثانویه

### C. نبود hierarchy ثابت برای density
در بعضی viewها حالت compact/comfortable هست، در بعضی نیست.

باید برای همه بخش‌ها تعریف شود:
- card density
- toolbar density
- list density

## مهم‌ترین مسائل فنی

### A. حذف `@ts-nocheck`
این اولویت شماره یک است. تا وقتی viewهای اصلی بدون type کار می‌کنند، UI polish ارزش کامل خودش را نشان نمی‌دهد.

### B. شکستن [App.tsx](/Users/aminsharifpour/Task1/apps/web/src/App.tsx)
این فایل هنوز بیش از حد بزرگ است و shell، auth، navigation، persistence و orchestration را همزمان نگه می‌دارد.

### C. ساخت `UIPreferencesStore`
باید همه stateهای سلیقه‌ای UI به یک لایه واحد منتقل شوند:
- sidebar
- density
- filters
- presentation mode
- hidden banners
- selected conversation/task view preferences

### D. استانداردسازی component props
نباید viewها با `props: any` جلو بروند. این باعث می‌شود قرارداد صفحه‌ها مستند و قابل‌اعتماد نباشد.

## نقشه راه اجرایی

### فاز 1: Stabilize Frontend Foundation
هدف: حذف ریسک‌های پرهزینه و آماده‌سازی برای توسعه سریع‌تر

کارها:
1. حذف `@ts-nocheck` از:
   - [dashboard-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/dashboard-view.tsx)
   - [chat-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/chat-view.tsx)
   - [projects-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/projects-view.tsx)
2. ساخت `UIPreferencesStore`
3. انتقال persistenceهای پراکنده از [App.tsx](/Users/aminsharifpour/Task1/apps/web/src/App.tsx) و [tasks-view.tsx](/Users/aminsharifpour/Task1/apps/web/src/components/app/tasks-view.tsx) به آن store
4. تعریف type contract برای page props

خروجی مورد انتظار:
- کاهش خطاهای UI
- رفتار قابل‌پیش‌بینی‌تر
- refactor ساده‌تر در فازهای بعدی

### فاز 2: Design System Hardening
هدف: یکدست‌سازی ظاهر و رفتار کل سیستم

کارها:
1. تعریف component patterns:
   - page header
   - filter toolbar
   - summary card
   - section card
   - action menu
   - empty state
   - status badge scale
   - avatar scale
2. مستندسازی این patternها در یک فایل design guideline
3. اعمال آن روی:
   - tasks
   - projects
   - chat
   - notifications
   - dashboard

خروجی مورد انتظار:
- ظاهر حرفه‌ای‌تر
- consistency بالاتر
- سرعت بیشتر در توسعه UI

### فاز 3: Interaction Simplification
هدف: کمتر کردن فشار شناختی و بهتر کردن بهره‌وری

کارها:
1. بازطراحی decision-first برای `notifications`
2. بازطراحی dual-mode برای `dashboard`
3. سبک‌سازی action surface در `HR` و `accounting`
4. تعریف mobile contract برای ماژول‌های پرتردد

خروجی مورد انتظار:
- استفاده سریع‌تر
- شلوغی کمتر
- مسیر تصمیم‌گیری روشن‌تر

## پیشنهاد اجرایی فوری
اگر بخواهیم همین حالا وارد اجرا شویم، بهترین شروع این است:

1. ساخت `UIPreferencesStore`
2. حذف `@ts-nocheck` از `dashboard`, `chat`, `projects`
3. شکستن `tasks-view` به زیرماژول‌ها

این سه کار بیشترین نسبت اثر به هزینه را دارند.

## تصمیم پیشنهادی
پیشنهاد من این است که اجرای واقعی از `فاز 1` شروع شود، نه از redesign جدید.

چون:
- اول باید فرانت پایدارتر و قابل‌تغییرتر شود
- بعد redesignها ارزان‌تر و امن‌تر می‌شوند
- در غیر این صورت، هر بهبود ظاهری هزینه نگهداشت را بالا می‌برد

