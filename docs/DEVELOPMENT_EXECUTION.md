# اجرای همه مراحل پیش از پولیش رابط

درخواست فعال کاربر در ۲۰۲۶-۱۰-۱۳: تمام توسعه دستور کار انجام شود، سپس روتوش/پولیش UI. طراحی فعلی شکوفلو/IRANYekan حفظ می‌شود؛ پولیش تزئینی در این مرحله انجام نمی‌شود. انتشار روی سرور زنده، خرید سرویس و DNS در scope نیست. هدف، کد کامل و بررسی قابل تکرار محلی/staging است.

## ترتیب کار فعال

1. هسته پروژه/تسک: قالب، چرخه پروژه، فیلدها، زیرتسک/چک‌لیست/وابستگی، زمان/ظرفیت، داشبورد، تقویم/گانت و بازبینی نسخه مشتری/داخلی. Migration 012/013 و API/UI نوشته شده‌اند؛ آزمون core PostgreSQL، regression ماژول/فایل و بررسی کامل مرورگر موفق‌اند.
2. onboarding و دسترسی (014/015 نوشته و آزموده): signup hosted و setup self-hosted، دعوت کامل، تنظیم سازمان/اعلان، entitlement و فعال‌سازی دستی audit‌شده، مدیریت نشست/رمز و realtime با revocation.
3. فایل: apply manifest قدیمی با archive منبع/نگاشت صریح/backup/checksum/idempotency (016) و پیوست صورت‌جلسه (017) اجرا و روی PostgreSQL مصنوعی آزموده شدند؛ S3-compatible، reconciliation/retention و قرارداد backup.
4. حفظ جزئیات ماژول‌های قدیمی: UI گزارش/بودجه مالی، HR، مدیریت کامل chat/تیم و کنترل همه paginationها.
5. لندینگ مستقل با CTA واقعی، فرم درخواست در DB، مدیریت درخواست، SEO و legal/config بدون قیمت/تأیید حقوقی حدسی.
6. عرضه فنی: release/Compose/TLS محلی، نصب تمیز/reboot/upgrade/restore، export، مشاهده query plans و آزمون بار مصنوعی دارای warm-up و steady state پانزده دقیقه؛ ظرفیت فقط بر اساس نتیجه واقعی.
7. پس از عبور معیارها: روتوش و پولیش رابط در درخواست/مرحله بعد.

قبولی partial gate به معنی تکمیل تمام این فهرست نیست. فایل اصلی db.json، .env و blob قدیمی دست‌نخورده‌اند. هیچ import روی منبع واقعی به preview مصنوعی انجام نمی‌شود. موارد تجاری مشخص‌نشده (قیمت، دامنه، متن حقوقی نهایی و تعهد پشتیبانی) با تنظیمات واقعی یا برچسب پیش‌نویس کنترل می‌شوند؛ حدس زده نمی‌شوند.

آزمون accounts: hosted signup، setup یک‌بار self-hosted، ثبت‌نام دعوت‌شده اتمیک، ظرفیت/لغو دعوت، تنظیمات، پنل اپراتور بدون دسترسی محتوا و ابطال رمز/نشست موفق. آزمون realtime با دو replica: scope و تایپ و revocation موفق. بررسی مرورگر پس از اتصال realtime موفق. S3، reconciliation/retention، جزئیات UI قدیمی، لندینگ و عرضه/بار همچنان در حال انجام‌اند؛ هیچ‌کدام تکمیل‌شده اعلام نمی‌شوند.

وضعیت جاری: S3 با RustFS واقعی (digest ثابت)، reconciliation فقط‌خواندنی/پاک‌سازی orphan هفت‌روزه، پیوست صورت‌جلسه، signup/setup/مهمان در مرورگر موفق‌اند. لندینگ مستقل و فرم درخواست/اپراتور/SEO در کد هستند؛ marketing integration موفق، Lighthouse/QA لندینگ باقی است. HR پرونده/تردد/گزارش و مالی CRUD/بودجه/گزارش گسترش یافتند؛ regression مرورگر پس از اصلاح relation مرخصی موفق. خروجی NDJSON با scope/جلسه در هر chunk و جستجوی فضای کار افزوده شده‌اند؛ آزمون اختصاصی در پیش است. بار اول ۳۰ کاربر: read p95=2337ms/write=2965ms، صفر خطا. دور دوم: read=397ms/write=1024ms، صفر خطا، 50670 invalidation؛ write هنوز رد هدف است. بهینه‌سازی بعدی (query مجوز و heartbeat دسته‌ای) اعمال و دور سوم ۱۵ دقیقه‌ای اجرا می‌شود. بسته release/TLS/install/reboot/restore و ۱۰۰/۳۰۰ کاربر همچنان باقی است.


به‌روزرسانی ۲۰۲۶-۱۰-۱۴: هسته/جزئیات ماژول‌ها، accounts/realtime، فایل local/S3 و legacy apply، lead/SEO، export/search و آزمون‌های API/مرورگر عبور کردند. Lighthouse معتبر mobile=91/96؛ یک اجرای NO_NAVSTART فاقد امتیاز معتبر در گزارش جدا نگه داشته شده و retry فقط برای خطای trace انجام شد. Compose نصب تمیز/TLS داخلی/restart/backup-restore مستقل و ارتقای schema ۱۸ به ۱۹ با backup قبلی موفق‌اند. S3 snapshot/restore به prefix تازه و pairing dump موفق است. تراکم نمایش معمولی/فشرده افزوده شده و آزمون آن در اجرای نهایی مرورگر قرار دارد. load-30-final موفق (read117/write146ms، صفر خطا)؛ اجرای ۱۰۰ قدیمی با توقف محیط قطع شد و report خالی قبولی ندارد. اجرای ۱۰۰ جدید با warm-up120s و steady900s فعال است؛ ۳۰۰ و بسته offline نهایی هنوز نتیجه ندارند. dry-run فایل واقعی: یک JPEG با بایت/اندازه/type معتبر؛ نگاشت سازمان مقصد باید واقعی و صریح باشد، import روی داده اصلی انجام نشده است.

آخرین بررسی: ۱۰۰ کاربر با ۵۹۸۱۶ درخواست/۹۰۰ثانیه، read p95=140ms، write=328ms، صفر خطا و ۱۰۰ اتصال فعال موفق شد. تقویم ماهانه واقعی Gregorian/Persian و ثبات تاریخ بدون ساعت در timezone غربی، تراکم ماندگار و صوت با میکروفون مصنوعی Chrome بررسی شدند. هدر microphone و عدم cache پاسخ API اصلاح شد. کنترل مسئول قبلی پس از demotion مهمان در HTTP/search/export/notification/realtime موفق است. Lighthouse دوباره 91/96 ثبت شد. پروفایل ۳۰۰ از نسخه تازه آغاز می‌شود؛ بسته offline بعد از آن ساخته/بررسی می‌شود.


تغییر روند به درخواست کاربر، ۲۰۲۶-۱۰-۱۴: آزمون فعال ۳۰۰ کاربر متوقف و fixture اختصاصی آن پاک شد؛ نتیجه پذیرش ندارد. آزمون‌های بیشتر به مرحله آخر توسعه موکول شدند. توسعه و بسته‌بندی ادامه دارد. تنظیمات signup، عمر نشست، توضیح برند، ایمیل تماس و متن حقوقی اکنون از env نصب به سرویس Compose منتقل می‌شوند.

بسته آفلاین نسخه توسعه 0.1.0 ساخته شد: image واحد، images.tar شامل API/web و PostgreSQL/Caddy، Compose با image IDs ثابت، manifest با SHA256، نصب‌کننده تازه با کنترل secrets/معماری/پروژه خالی و verifier مستقل. اجرای installer، آزمون خرابی بسته و مسیر شکست upgrade به مرحله پایانی منتقل‌اند؛ این بسته هنوز تأیید نهایی عرضه ندارد.

روتوش UI براساس تصاویر Sprinta با حفظ هویت شکف انجام شد: shell/sidebar/header/typography/spacing، داشبورد واقعی، پیام‌های گفتگو، کارت‌های صورت‌جلسه و عضو. production build و مشاهده کوتاه ۱۴۴۰/۳۹۰ موفق؛ آزمون جامع و بار همچنان موکول به پایان است. preview روی 8896 با dist تازه دوباره راه‌اندازی شد. بسته offline قبل از این روتوش است.

صفحه پروژه‌ها طبق درخواست کاربر فقط با کامپوننت‌های HeroUI بازطراحی شد: جدول scoped قابل جستجو/فیلتر/صفحه‌بندی، جزئیات، مودال ایجاد با مسئول و تاریخ و قالب، حفظ هویت شکف/IRANYekan/RTL. ساخت سازمان و پذیرش دعوت از فهرست به حساب منتقل شدند؛ ابزار مدیریت پروژه در صفحه مستقل در دسترس است. build/typecheck موفق، مشاهده محدود دسکتاپ/موبایل موفق. preview 8896 آخرین dist را اجرا می‌کند. آزمون‌های جامع اجرا نشدند.

ریدیزاین جدول و مودال تسک با HeroUI و هویت شکف تکمیل شد. نام مجاز مسئول به خروجی فهرست افزوده شد. امکانات قبلی حفظ و prompt تغییر وضعیت با مودال جایگزین شد. Typecheck/build موفق و مشاهده محدود ظاهر دسکتاپ/موبایل انجام شد؛ آزمون جامع و بار اجرا نشده‌اند. preview 8896 آخرین نسخه را اجرا می‌کند.

ریدیزاین اعضا و تیم‌ها با HeroUI تکمیل شد: جدول اعضا با آواتار واقعی/حروف اول نام و جستجو/صفحه‌بندی، مودال عضو جدید و مدیریت دسترسی، کارت و مودال تیم. سیاست مجوز مستقل مالی/HR و نقش‌های محافظت‌شده حفظ شد. build/typecheck و بررسی محدود نمایشی موفق؛ تست جامع/بار اجرا نشده. preview8896 نسخه تازه را اجرا می‌کند.

ریدیزاین صورت‌جلسه با HeroUI تکمیل شد: جدول، جستجو/بازه تاریخ/صفحه‌بندی و مودال ثبت/ویرایش/جزئیات/پیوست/تأیید حذف. پیوست‌ها قرارداد قبلی را حفظ می‌کنند. typecheck/build و مشاهده محدود دسکتاپ/موبایل موفق؛ آزمون جامع و بار اجرا نشده‌اند. preview8896 نسخه تازه را اجرا می‌کند.

اصلاح انحنای ستون کناری جدول‌ها و عملیات آیکونی تکمیل شد: Table secondary واقعی HeroUI و سبک مشترک با سلول صاف، Title ایستا، TableAction آیکونی دارای Tooltip و aria-label. پروژه/تسک/اعضا/صورت‌جلسه و جدول داشبورد هماهنگ شدند. مشاهده محدود سلول‌های موجود radius=0، آیکون‌ها و بازشدن جزئیات پروژه موفق، بدون pageerror. آزمون جامع و بار موکول به پایان باقی است.

تب اعضا و تیم‌ها با HeroUI اضافه شد؛ هر تب جدول و تنظیمات مستقل دارد، فیلتر حفظ می‌شود. نمایش تیم‌ها اکنون جدول با عملیات آیکونی و مودال‌های قبلی است. جستجوی نام تیم به API اضافه شد. build/typecheck و مشاهده محدود تب‌ها در دسکتاپ/موبایل موفق؛ آزمون جامع و بار اجرا نشده‌اند. preview8896 تازه است.


ماژول گفتگو (۱۴ اکتبر): رابط سه‌بخشی با HeroUI v3، رنگ سبز برند، IRANYekan و RTL. صندوق/ستاره/ارسال‌شده/پیش‌نویس/بایگانی/سطل زباله و برچسب شخصی در PostgreSQL؛ مهاجرت افزایشی 020 بدون تغییر داده‌های اصلی. جستجوی متن و همکار، صفحه‌بندی گفتگو/پیام/اعضا، آواتار واقعی یا حروف نام، انتخاب همه اعضای فعال داخلی سازمان، گفتگوی خصوصی با استفاده مجدد از اتاق موجود و گروه با مدیریت اعضا. پنجره مشاهده و ارسال سریع، Enter/Shift+Enter، پاسخ/بازارسال/واکنش/ویرایش و حذف پیام شخصی در مهلت موجود، خواندن خودکار، حضور و تایپ. ارسال تا پنج فایل با سقف موجود، تصویر با پیش‌نمایش خصوصی، ضبط ویس حداکثر دو دقیقه و پخش صوت؛ انتخاب ایموجی و اشاره به عضو. مسیر خصوصی و کلیدهای idempotency بارگذاری/ارسال حفظ شدند. پیش‌نویس متن با درخواست‌های ترتیبی ذخیره می‌شود؛ پنجره سریع پیش‌نویس اصلی را بازنویسی نمی‌کند.
اعتبارسنجی محدود: TypeScript و build موفق؛ migration در review_foundation اعمال شد؛ دریافت واقعی فهرست، خلاصه صندوق، جزئیات/پیام‌ها و اعضا و مشاهده پنجره ساخت/سریع/ایموجی بدون خطای API یا pageerror؛ عرض ۳۹۰ بدون overflow. تصاویر .tmp/ui-polish/chat. پیام، فایل یا حساب تازه در این بررسی ثبت نشده و میکروفون واقعی استفاده نشده است. بررسی جامع چندکاربره، ارسال فایل/صوت و بازیابی پس از قطع شبکه طبق خواسته کاربر در مرحله آخر اجرا می‌شود. فایل db.json و داده‌های اصلی دست‌نخورده‌اند. ویس، پیام صوتی است؛ تماس زنده پیاده‌سازی نشده.


پالت مکمل (۱۴ اکتبر): سبز برند و دکمه اصلی حفظ شد؛ رنگ متن، زمینه و حاشیه‌ها خنثی‌تر شدند. آبی برای پروژه‌ها، بنفش برای کارهای جاری و مدیریت، کهربایی برای انتظار/جلسات، صورتی تیره برای دیرکرد و حذف، فیروزه‌ای برای تیم‌ها/منابع انسانی. آیکون‌های سایدبار، کارت‌های آماری و نمودار داشبورد، وضعیت/اولویت جدول‌ها، برچسب‌ها و اقدامات جدول از پالت مشترک استفاده می‌کنند. رنگ آواتار جایگزین بر مبنای نام پایدار است و بین گفتگو و جدول اعضا یکسان می‌ماند. ساخت موفق و مشاهده محدود پنج صفحه بدون pageerror و عرض ۳۹۰ بدون overflow؛ داده و API تغییر نکردند. تصاویر در .tmp/ui-polish/palette. آزمون جامع همچنان برای مرحله آخر باقی است.


بازطراحی اعلان‌ها (۱۴ اکتبر): ماژول مستقل notifications-panel با Table/Card/Tabs/TextField/Select/Chip/Modal/Spinner و عملیات آیکونی Tooltip از HeroUI v3. چهار شمارنده و تب همه/خوانده‌نشده/خوانده‌شده/بسته‌شده، جستجوی عنوان و متن و فیلتر نوع روی سرور، صفحه‌بندی ۲۵ رکوردی و حالت خالی/بارگذاری/خطا. جزئیات در مودال و لینک منابع مرتبط از رویداد سازمانی؛ خواندن/خوانده‌نشده/بستن/بازیابی و خواندن همه فعال حفظ شد. تنظیمات شخصی در مودال با کارت‌های رنگی و Switch برای دریافت/مرکز/اطلاع/صدا؛ هنگام ویرایش، به‌روزرسانی بلادرنگ فرم را بازنویسی نمی‌کند و دسته‌های خاموش قبلی حفظ می‌شوند. خلاصه و فهرست با همان predicate دسترسی و تنظیمات شخصی، در readScoped تازه اجرا می‌شوند؛ داده یا schema تغییر نکرد.
TypeScript/build و بررسی syntax API موفق. مشاهده محدود داده واقعیِ خالی، چهار تب، جستجو و مودال تنظیمات بدون API error/pageerror؛ عرض ۳۹۰ بدون overflow. عملیات نوشتنی و پخش صدا در این بررسی اجرا نشد؛ آزمون جامع مرحله آخر باقی است. تصاویر در .tmp/ui-polish/notifications؛ نسخه لوکال با build جدید راه‌اندازی شد.


بازطراحی منابع انسانی (۱۴ اکتبر): HrPanel با HeroUI v3 و چهار تب پرونده/مرخصی/تردد/گزارش؛ جدول‌های secondary، آواتار و رنگ مکمل، جستجو و فیلتر سروری، بازه تاریخ و صفحه‌بندی ۲۵ رکوردی، عملیات آیکونی Tooltip و مودال‌های ثبت/ویرایش/جزئیات. تمام فیلدهای پرونده قبلی شامل حقوق و واحد آن، نوع قرارداد، مدیر مستقیم، تحصیلات/مهارت‌ها، تماس اضطراری و یادداشت حفظ شدند. فرم به‌جای بازنویسی حین تایپ، پرونده را یک بار هنگام انتخاب عضو می‌گیرد. یادداشت تصمیم مرخصی برای همان درخواست در مودال است؛ تأیید خود و تصمیم تکراری همچنان در سرور منع می‌شود. ثبت/ویرایش/حذف تردد و محاسبه ساعت کار حفظ شدند؛ ویرایش رکورد موجود کلید همکار/روز را تغییر نمی‌دهد. گزارش کارکرد با بازه، آمار حضور/دورکاری، میانگین ساعت و خروجی CSV داده مجاز با محافظت فرمول CSV. خواندن فهرست‌ها با readScoped تازه، مجوز مستقل HR و دامنه خودی اعضای عادی؛ schema و داده اصلی تغییر نکردند.
ساخت نهایی و syntax API موفق. مشاهده محدود چهار تب، جستجو و سه مودال با داده واقعی بررسیِ خالی بدون API error/pageerror؛ عرض ۳۹۰ بدون overflow. رکورد، درخواست یا پرونده تازه ثبت نشد؛ عملیات مدیریتی و سناریوهای جامع مجوز/گزارش/CSV برای مرحله آخر باقی‌اند. تصاویر .tmp/ui-polish/hr؛ نسخه لوکال با build جدید راه‌اندازی شد.


امور مالی و تنظیمات سیستم (۱۴ اکتبر): امور مالی از ناوبری محصول سازمانی، مسیر صفحه، مجوزهای قابل تنظیم اعضا، تنظیمات ماژول/اپراتور و خروجی‌های UI حذف شد. ensureModule دسترسی API و خروجی مالی محصول سازمانی را نیز با MODULE_DISABLED متوقف می‌کند؛ defaultModules و خروجی تنظیمات آن را غیرفعال نشان می‌دهند. کد قدیمی و داده‌های مالی/مجوزهای ذخیره‌شده برای بازیابی بعدی حفظ شدند؛ جدول یا سند مالی حذف نشد. آزمون‌های قدیمیِ فعال‌بودن مالی در مرحله نهایی باید با دامنه جدید محصول تطبیق داده شوند.
SettingsPanel با HeroUI v3 و پالت مکمل بازطراحی شد: نمای ظرفیت عضو/فایل با Meter، طرح واقعی سازمان، تب اطلاعات/تقویم/منطقه زمانی، سوییچ‌های ماژول‌ها، جدول دعوت‌ها و مودال ایجاد لینک، جدول خروجی NDJSON منابع مجاز، جدول تاریخچه و ظرفیت نصب محلی فقط برای مالک self_hosted. هر تب تنظیمات خودش را ذخیره می‌کند؛ PATCH /settings ذخیره تنظیمات ماژول را در همان تراکنش مجاز انجام می‌دهد و نیاز به دو درخواست متوالی قبلی نیست. فرم تایپ‌شده با تازه‌سازی آمار بازنویسی نمی‌شود. ساخت، لینک کپی و لغو دعوت با API موجود است؛ ایمیل خودکار اضافه نشد.
Build/TypeScript و syntax API موفق؛ مشاهده محدود پنج تب و مودال دعوت بدون API error/pageerror و عرض ۳۹۰ بدون overflow. منوی مالی صفر و GET مستقیم accounts پاسخ 403 داشت. تنظیم، دعوت یا خروجی تازه در بررسی ثبت/ارسال/دانلود نشد؛ تست جامع برای مرحله آخر باقی است. تصاویر .tmp/ui-polish/settings. نسخه لوکال با build جدید فعال است؛ schema و داده اصلی دست‌نخورده‌اند.

### 2026-10-14 — Account/settings navigation consolidation
Account/security now lives under System Settings as a HeroUI tab. Account capabilities and existing backend permissions are preserved; the header shortcut opens the account tab and the standalone sidebar item is removed. Organization-scoped settings reset on organization change. Production build and narrow read-only browser checks passed; comprehensive acceptance tests remain deferred by user instruction.

### 2026-10-14 — Account/security redesign
Implemented consistent HeroUI account cards, forms, paginated active-session table and revoke confirmation; retained organization join/create, browser density and operator capabilities. Existing password/session behavior remains in place with added matching-password validation. Production build and read-only desktop/mobile display checks passed. No mutation checks or broad acceptance suite run, per the user's deferred testing instruction.

### 2026-10-14 — Sidebar expand/collapse
Implemented desktop expanded/icon-only navigation with local preference persistence and HeroUI tooltips. Content margins resize with the sidebar; mobile drawer remains fully labeled. Production build and narrow read-only desktop/mobile rendering check passed; no module mutations or comprehensive test suite run.

### 2026-10-14 — Header and avatars
Implemented header search dialog, organization-aware live date/time and HeroUI account menu. Added authenticated profile-photo endpoints and UI for own account/authorized member management; additive UserAvatar migration 021 applied only to the local review database. Images are validated and normalized with production Sharp, stored in PostgreSQL and served privately to authorized colleagues. Build and narrow UI/API checks passed; temporary synthetic own-photo restored to its initial absent state. Broad acceptance testing remains pending by user instruction.

### 2026-10-15 — Task timeline and Jalali dates
Implemented a fresh-scoped interval timeline endpoint and a dedicated day/week/month Jalali Gantt with project metadata, prerequisite arrows, scheduling conflict cues, missing-date handling and bounded pagination. Added optimistic versioned date editing with shared Persian date validation; task date forms and task calendar now use Jalali presentation. No schema change or record migration was needed. Production build, real read-only endpoint check and browser-fixture layout checks passed; no task records changed. Broader acceptance tests remain pending per user instruction. Local review is running on 127.0.0.1:8896.

### 2026-10-15 — HR dialogs
Completed consistent HeroUI modal layout for personnel create/edit/details, leave create/review/details, attendance create/edit/details and delete confirmation. Preserved every existing profile field, permission gate and endpoint; added Jalali date presentation, sections and fixed footer actions. Build and browser-only fixture rendering checks passed without HR mutations. Comprehensive functional and permission testing remains deferred by user instruction.

### 2026-10-15 — Workspace dashboard
Completed HeroUI dashboard redesign with clearer metrics/status distribution, project progress summaries, personal tasks and preserved workload/capacity management. Added status-group and visibility-filtered project summaries to the existing fresh-scoped endpoint; no migration required. Production build, actual read-only summary checks and narrow responsive UI checks passed. No business records changed; comprehensive acceptance/permission testing remains pending per user instruction.

### 2026-10-15 — Authentication screens
Completed HeroUI login redesign plus matching signup/setup forms, responsive branding layout, password visibility and normalized phone input. Authentication endpoints, invitation logic and session handling were retained. Production build and narrow rendering/interaction checks passed using a mocked error response without account mutations. Local preview refreshed at http://127.0.0.1:8896/login; broad acceptance testing remains deferred.

### 2026-10-15 — Minimal UI animations
Added dependency-free scoped CSS animations to foundation navigation/content, dashboard cards, authentication and interaction feedback. HeroUI overlays retain their lifecycle/focus behavior with subtler entrance motion. Reduced-motion support includes portal content. Build and narrow browser style/dismissal/responsive checks passed; no business mutations. Local preview refreshed on port 8896.

### 2026-10-15 — Application-wide Jalali display
Unified active foundation date presentation under the Persian calendar regardless of old organization calendar preferences. Converted remaining project/workflow/minute date editors and filters to shared Jalali inputs and aligned work-date defaults with organization timezone. Existing ISO API/data/export contracts remain unchanged; no migration. Production build and narrow non-mutating conversion/validation/responsive checks passed. Refreshed local runtime on port 8896; comprehensive acceptance testing remains deferred.

### 2026-10-15 — Calendar date selection
Implemented shared HeroUI Persian DatePicker across active forms/filters that use JalaliDateField. Includes month/year navigation, segmented keyboard entry, Today/optional clear actions and retained date bounds/required validation. Build and narrow browser-fixture popup/conversion/mobile checks passed without business writes. Local runtime refreshed on port 8896.

### 2026-10-15 — Illustration-led public landing
Rebuilt the public home with a warm cream/forest-green Shekof family design, two original transparent illustrations, HeroUI sample product tabs, workflow steps, capabilities, deployment choices and FAQ. Preserved existing contact/lead and legal paths plus authentication destination rules. Read-only Shekoflow reference repository remained clean. Build and narrow desktop/mobile interaction/rendering checks passed, with no protected API requests or business writes. Local preview available at http://127.0.0.1:8896/; details in docs/LANDING_DESIGN.md.
