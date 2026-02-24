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
3. (اختیاری) اگر بخشی از اپ API جداگانه است، حتماً `npm run dev:api` یا `npm start` را بررسی کن.

## ۴. راه‌اندازی سرویس systemd
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
   ExecStart=/usr/bin/node server/index.js
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

## ۵. راه‌اندازی پروکسی معکوس (Nginx)
1. نصب Nginx:
   ```bash
   sudo apt install -y nginx
   ```
2. ایجاد فایل سایت (`/etc/nginx/sites-available/tasks`):
   ```nginx
   server {
     listen 80;
     server_name example.com;

     location / {
       proxy_pass http://127.0.0.1:8787;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
   }
   ```
3. فعال‌سازی سایت و راه‌اندازی مجدد nginx:
   ```bash
   sudo ln -sf /etc/nginx/sites-available/tasks /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## ۶. راهکارهای امنیتی و پایداری
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

## ۷. به‌روزرسانی و نگهداری
1. برای به‌روزرسانی کد:
   ```bash
   cd /srv/tasks
   git pull
   npm ci
   npm run build
   sudo systemctl restart tasks.service
   ```
2. پشتیبان‌گیری از دیتابیس ساده (`server/data/db.json`) قبل از هر تغییر.

## ۸. نکات اضافی
- اگر بک‌اند و فرانت مجزا شوند، `VITE_API_BASE` را به آدرس واقعی API تنظیم کن.
- از `pm2` برای مشاهده لاگ گرافیکی و مدیریت پروسس هم می‌توان استفاده کرد.
- برای ورود به کنسول، `ssh -i key.pem ubuntu@server-ip` استفاده کن.
