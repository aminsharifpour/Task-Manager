# راهنمای استقرار کامل روی سرور ابری Ubuntu 24.04

این سند چک‌لیست گام‌به‌گام برای پیاده‌سازی اپلیکیشن روی یک ماشین ابری با Ubuntu 24.04 است.

## ۱. پیش‌نیازهای سیستم
1. لاگین به سرور (SSH) و به‌روزسازی بسته‌ها:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```
2. نصب Node.js 20 (LTS) و npm از منابع رسمی NodeSource:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs build-essential
   ```
3. نصب Yarn (اختیاری ولی پیشنهاد می‌شود برای نصب سریع‌تر بسته‌ها):
   ```bash
   npm install -g yarn
   ```
4. نصب Git، curl و unzip:
   ```bash
   sudo apt install -y git curl unzip
   ```

## ۲. انتقال کد به سرور
1. کلون ریپوی پروژه یا کپی فایل‌ها به پوشه دلخواه (مثلاً `/srv/tasks`):
   ```bash
   sudo mkdir -p /srv/tasks
   sudo chown $USER:$USER /srv/tasks
   git clone <repository_url> /srv/tasks
   cd /srv/tasks
   ```
2. فایل‌های محیطی را مطابق نیاز سرور تنظیم کن (`.env` یا `VITE_API_BASE` اگر به بک‌اند مجزا وصل هستی).

## ۳. نصب وابستگی‌ها و ساخت
1. نصب وابستگی‌ها (npm یا yarn):
   ```bash
   cd /srv/tasks
   npm ci
   # یا yarn install
   ```
2. اجرای بیلد برای تولید نسخه production:
   ```bash
   npm run build
   ```
3. برای استقرار جدا:
   - فرانت: `npm run build:web`
   - بک‌اند: `npm run start:api`

## ۴. استقرار جداگانه فرانت و بک‌اند
1. بک‌اند را به‌صورت API-only بالا بیاور:
   ```bash
   cp .env.backend.example .env
   # JWT_SECRET / CORS_ORIGIN / PORT را تنظیم کن
   npm ci
   npm run start:api
   ```
2. فرانت را با آدرس API واقعی build کن:
   ```bash
   cp .env.frontend.example .env.production.local
   # VITE_API_BASE را روی دامنه API بگذار
   npm ci
   npm run build:web
   ```
3. خروجی `dist/` را روی Nginx یا هر static host جدا منتشر کن.
4. برای بک‌اند، `SERVE_CLIENT=false` بماند تا هیچ وابستگی به `dist` نداشته باشد.

## ۵. راه‌اندازی سرویس systemd
1. فایل سرویس را بساز (`/etc/systemd/system/tasks.service`):
   ```ini
   [Unit]
   Description=Tasks App
   After=network.target

   [Service]
   Type=simple
   User=ubuntu
   WorkingDirectory=/srv/tasks
   Environment=NODE_ENV=production
   Environment=PORT=8787
   Environment=SERVE_CLIENT=false
   ExecStart=/usr/bin/node apps/api/src/index.js
   Restart=on-failure
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```
   مسیر `ExecStart` را اگر از `npm start` استفاده می‌کنی به `/usr/bin/npm start` تغییر بده.
2. بارگذاری سرویس و فعال‌سازی:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now tasks.service
   sudo systemctl status tasks.service
   ```

## ۶. راه‌اندازی پروکسی معکوس (Nginx)
1. نصب Nginx:
   ```bash
   sudo apt install -y nginx
   ```
2. ایجاد فایل سایت (`/etc/nginx/sites-available/tasks`):
   ```nginx
   server {
     listen 80;
     server_name example.com;

     location /api/ {
       proxy_pass http://127.0.0.1:8787;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
     }

     location /socket.io/ {
       proxy_pass http://127.0.0.1:8787;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
     }

     location /uploads/ {
       proxy_pass http://127.0.0.1:8787;
       proxy_set_header Host $host;
     }
   }
   ```
3. فعال‌سازی سایت و راه‌اندازی مجدد nginx:
   ```bash
   sudo ln -sf /etc/nginx/sites-available/tasks /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## ۷. راهکارهای امنیتی و پایداری
- فعال کردن فایروال UFW فقط برای HTTP/HTTPS/SSH:
  ```bash
  sudo ufw allow OpenSSH
  sudo ufw allow 'Nginx Full'
  sudo ufw enable
  ```
- تنظیم SSL رایگان با Certbot:
  ```bash
  sudo apt install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d example.com
  ```
- فعال کردن مانیتورینگ سرویس:
  ```bash
  sudo journalctl -u tasks.service -f
  ```
  افزونه: نصب `pm2` یا `systemd` برای رصد بهتر.

## ۸. به‌روزرسانی و نگهداری
1. برای به‌روزرسانی کد:
   ```bash
   cd /srv/tasks
   git pull
   npm ci
   npm run build
   sudo systemctl restart tasks.service
   ```
2. پشتیبان‌گیری از دیتابیس ساده (`apps/api/data/db.json`) قبل از هر تغییر.

## ۹. نکات اضافی
- برای جداسازی کامل، فرانت را از روی Nginx/Static host و بک‌اند را از روی systemd/Node بالا بیاور.
- `SERVE_CLIENT=false` یعنی بک‌اند فقط API و فایل‌های `/uploads` را سرو می‌کند.
- از `pm2` برای مشاهده لاگ گرافیکی و مدیریت پروسس هم می‌توان استفاده کرد.
- برای ورود به کنسول، `ssh -i key.pem ubuntu@server-ip` استفاده کن.
