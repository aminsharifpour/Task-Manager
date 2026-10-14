# ADR 002 — نشست و لغو دسترسی

وضعیت: اجراشده، ۲۰۲۶-۱۰-۱۴.

JWT با secret خصوصی اعتبارسنجی می‌شود؛ نقش claim مرجع permission نیست. AuthSession با jti/انقضا در PostgreSQL ایجاد می‌شود و token بدون نشست معتبر پذیرفته نمی‌شود. logout، تغییر رمز، غیرفعال‌سازی هویت و revoke عضویت دسترسی درخواست بعدی و تحویل realtime را می‌بندند. نشست/عضویت در تحویل زنده مجدداً کنترل و lock مناسب با تغییر هم‌زمان دارد.

bearer در sessionStorage نگهداری می‌شود. cookie استفاده نمی‌شود، بنابراین نسخه حاضر CSRF cookie ندارد. این انتخاب نیازمند پیشگیری XSS است: محتوای فضای کار به‌صورت متن React، فایل با download/private/no-store/nosniff و metadata HTML با escaping ارائه می‌شوند؛ secret به bundle یا URL نمی‌رود. HttpOnly cookie می‌تواند در تغییر معماری auth آینده با CSRF/same-site کامل جایگزین شود، ولی toggle یا cookie نیمه‌کاره اضافه نشده است.

رمز جدید/ثبت‌نام/setup حداقل ۱۲ کاراکتر غیر whitespace و حداکثر ۷۲ بایت UTF8 برای bcrypt دارد؛ legacy password هنگام ورود برای سازگاری حفظ می‌شود. حساب/نشست UI و signup دعوت‌شده، پذیرش اتمیک و ابطال همه نشست‌ها آزموده شده‌اند. rate limit پایگاه برای login/signup/invite/upload و packet Socket مشترک است.
