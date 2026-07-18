# 🚀 دليل رفع ونشر مشروع DataScraperPro على GitHub و Hostinger (احترافي)

أهلاً بك! هذا الدليل الشامل يوضح كيفية رفع مشروع **DataScraperPro** على **GitHub** برابط خاص وأمان عالي، ثم ربطه واستضافته على سيرفرات **Hostinger** للعمل بصفة مستمرة (24/7).

---

## 📑 فهرس المحتويات
1. [الهيكلية والمتطلبات الأساسية](#1-الهيكلية-ومتطلبات-التطبيق)
2. [خطوات رفع المشروع إلى GitHub بأمان](#2-خطوات-رفع-المشروع-إلى-github-بأمان)
3. [خيارات النشر على Hostinger](#3-خيارات-النشر-على-hostinger)
   - [الخيار الأول: الربط المباشر مع GitHub عبر hPanel (الأسهل)](#الخيار-الأول-الربط-المباشر-مع-github-عبر-hpanel-الأسهل)
   - [الخيار الثاني: النشر التلقائي عبر GitHub Actions (CI/CD)](#الخيار-الثاني-النشر-التلقائي-عبر-github-actions-cicd)
   - [الخيار الثالث: التثبيت على سيرفر Hostinger VPS (PM2 + Nginx)](#الخيار-الثالث-التثبيت-على-سيرفر-hostinger-vps-pm2--nginx)
4. [إعداد المتغيرات البيئية (Environment Variables)](#4-إعداد-المتغيرات-البيئية-environment-variables)
5. [أوامر التثبيت والبناء (Build & Postinstall)](#5-أوامر-التثبيت-والبناء-build--postinstall)
6. [فحص وتأكيد عمل التطبيق (Verification)](#6-فحص-وتأكيد-عمل-التطبيق-verification)
7. [حل المشاكل الشائعة (Troubleshooting)](#7-حل-المشاكل-الشائعة-troubleshooting)

---

## 1. الهيكلية ومتطلبات التطبيق

التطبيق يعتمد على:
- **Frontend**: React (Vite) يُبنى داخل مجلد `dist`.
- **Backend**: Node.js Express في مجلد `server/server.js`.
- **Database / Auth**: Supabase Backend Services.

```text
DataScraperPro/
├── server/               # سيرفر Express وخدمات الكشط (Scraping)
│   ├── server.js         # نقطة الدخول الرئيسية للسيرفر (Entry Point)
│   └── package.json      # حزم الباك-إند
├── src/                  # واجهة المستخدِم React (Vite)
├── dist/                 # المجلد الناتج بعد عملية الـ Build (يتم توليده تلقائياً)
├── package.json          # الملف الرئيسي للأوامر والحزم
├── .gitignore            # حماية الجلسات والمفاتيح
└── Hostinger/            # إعدادات مخصصة لاستضافة Hostinger
```

---

## 2. خطوات رفع المشروع إلى GitHub بأمان

> ⚠️ **تنبيه أمني هام**: تم ضبط ملف `.gitignore` بحيث يُمنع تماماً رفع الجلسات والمفاتيح الحساسة الخاصة بحسابات تليجرام أو قواعد البيانات المحلية مثل:
> - `server/telegram_accounts.json`
> - `server/telegram_sessions/`
> - `.env` / `.env.local`

### أ) عبر المبدل البرمجي (Git Terminal)

افتح مبدل الأوامر (Terminal) في المجلد الرئيسي `DataScraperPro`:

```bash
# 1. تهيئة المستودع (إذا لم يكن مهيئاً)
git init

# 2. إضافة جميع الملفات (سيتم استبعاد الملفات المحمية تلقائياً)
git add .

# 3. حفظ التغييرات ورسالة الإيداع
git commit -m "feat: setup professional deployment package for GitHub & Hostinger"

# 4. تغيير الفرع إلى main
git branch -M main

# 5. ربط المستودع بـ GitHub (استبدل الرابط برابط مستودعك الخاص)
git remote add origin https://github.com/YOUR_USERNAME/DataScraperPro.git

# 6. رفع الكود
git push -u origin main
```

---

## 3. خيارات النشر على Hostinger

---

### الخيار الأول: الربط المباشر مع GitHub عبر hPanel (الأسهل)

إذا كنت تستخدم استضافة Hostinger Node.js / Cloud Hosting:

1. ادخل إلى **hPanel** الخاص بك على Hostinger.
2. اذهب إلى قسم **Advanced** -> اختر **Git** أو **Node.js Application**.
3. قم بإنشاء تطبيق Node.js جديد واضبط الإعدادات التالية:
   - **Node.js Version**: `20.x` أو `22.x`.
   - **Application Root**: `/public_html` أو مجلد التطبيق.
   - **Application Startup File / Entry Point**: `server/server.js`.
   - **Repository URL**: رابط مستودع GitHub الخاص بك.
   - **Branch**: `main`.
4. اضغط على **Deploy / Save**.

---

### الخيار الثاني: النشر التلقائي عبر GitHub Actions (CI/CD)

يوجد ملف أتمتة جاهز داخل المشروع في المسار `.github/workflows/deploy.yml`.

---

## 4. إعداد المتغيرات البيئية (Environment Variables)

على خادم **Hostinger** (في لوحة hPanel تحت قسم **Environment Variables**):

قم بضبط القيم التالية:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://tddgfyxmublwqilfzmvx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZGdmeXhtdWJsd3FpbGZ6bXZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMjE1NzgsImV4cCI6MjA5ODU5NzU3OH0.-zrRh4rqzbqGua_4q7BFPf_8i7mCqva6HyjKaYaECDM

# Google Places API Key
GOOGLE_PLACES_API_KEY=AIzaSyBaeqVsZuiAKe7tPpHuFqBWj0LMPuXpp2c

# Server Configuration
PORT=3000
NODE_ENV=production
```

---

## 5. أوامر التثبيت والبناء (Build & Postinstall)

تم إعداد ملف `package.json` الرئيسي ليتكفل بجميع عمليات التثبيت تلقائياً عند التشغيل على الخادم:

- عند تشغيل `npm install` على Hostinger:
  سيقوم بالأمر التلقائي `postinstall` بتثبيت حزم `server/package.json` وبناء ملفات الفرونت-إند تلقائياً عبر `vite build`.

- لتشغيل السيرفر الرئيسي:
  ```bash
  npm start
  ```
