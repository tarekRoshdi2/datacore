# 🚀 DataCore — Data Scraper Pro

![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth+DB-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)

> **منصة احترافية لاستخراج وإدارة البيانات — Web Scraping · Google Maps · Telegram · Email**

> ⚠️ **هذا مشروع Full-Stack** — الـ Backend (Express) يجب أن يعمل لكي تشتغل جميع الميزات. **لا يصلح نشره كـ Static Site فقط.**

---

## 📑 المحتويات

1. [نظرة عامة](#-نظرة-عامة)
2. [هيكل المشروع](#-هيكل-المشروع)
3. [التشغيل المحلي](#-التشغيل-المحلي)
4. [المتغيرات البيئية](#-المتغيرات-البيئية)
5. [النشر على Hostinger — الطريقة الصحيحة](#-النشر-على-hostinger--الطريقة-الصحيحة)
6. [النشر على منصات أخرى](#-النشر-على-منصات-أخرى)
7. [حل المشاكل الشائعة](#-حل-المشاكل-الشائعة)

---

## 🔍 نظرة عامة

| الطبقة | التقنية | الوصف |
|---|---|---|
| **Frontend** | React 19 + Vite 8 | واجهة مستخدم تفاعلية |
| **Backend** | Node.js + Express | API Server يعالج كل العمليات |
| **Database/Auth** | Supabase | المصادقة وتخزين البيانات |
| **Scraping** | Axios + Cheerio | استخراج بيانات المواقع |
| **Maps** | Google Places API (New) | بيانات الأماكن والأعمال |
| **Telegram** | GramJS | إدارة حسابات وكشط مجموعات |
| **Email** | Nodemailer | إرسال بريد عبر SMTP |

---

## 📁 هيكل المشروع

```
dataCore/
├── src/                        # Frontend (React + Vite)
│   ├── App.jsx
│   ├── components/
│   │   ├── EmailsPage.jsx
│   │   ├── TelegramDashboard.jsx
│   │   └── YellowPagesDashboard.jsx
│   ├── supabaseClient.js
│   └── config.js
├── server/                     # Backend (Node.js + Express)
│   ├── server.js               # نقطة الدخول الرئيسية
│   ├── telegramManager.js
│   └── package.json
├── dist/                       # (مولّد تلقائياً بعد البناء)
├── .env                        # لا تُرفع لـ GitHub ابداً
├── .env.example                # نموذج المتغيرات (ارفع هذا)
├── package.json
└── vite.config.js
```

---

## 💻 التشغيل المحلي

```bash
# 1. استنساخ المشروع
git clone https://github.com/YOUR_USERNAME/dataCore.git
cd dataCore

# 2. نسخ ملف المتغيرات البيئية وتعبئته
cp .env.example .env

# 3. تثبيت جميع المكتبات (frontend + backend + build تلقائياً)
npm install

# 4. تشغيل الفرونت في وضع التطوير
npm run dev          # http://localhost:5173

# 5. تشغيل الباكند (terminal منفصل)
node server/server.js  # http://localhost:3000
```

---

## 🔐 المتغيرات البيئية

انسخ `.env.example` إلى `.env` وعبّئ القيم:

```env
# === Frontend (Vite) ===
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# في dev: اتركها فارغة | في production: رابط الـ API إذا كان منفصلاً
VITE_API_URL=

# === Backend (Node.js) ===
PORT=3000
NODE_ENV=production
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

> 🔒 ملف `.env` مُدرج في `.gitignore` ولن يُرفع لـ GitHub أبداً.

---

## 🌐 النشر على Hostinger — الطريقة الصحيحة

### ⚠️ لماذا الإعداد الحالي (Vite Static) لا يعمل؟

```
الإعداد الحالي (خاطئ):          الإعداد الصحيح:
─────────────────────────        ─────────────────────────
Framework: Vite (Static)  →→→   Node.js Application
Build: npm run build             Entry: server/server.js
Output: dist/                    Start: npm start

✅ يخدم React فقط               ✅ يشغّل Express Server
❌ /api/* → 404 Error            ✅ /api/* تعمل بالكامل
❌ Telegram → لا يعمل            ✅ Telegram + Maps + Email
❌ Maps → لا يعمل                ✅ Web Scraping يعمل
❌ Email → لا يعمل               ✅ كل شيء يعمل 24/7
```

---

### ✅ الخيار الصحيح: Node.js Application على Hostinger VPS

#### الخطوة 1 — في hPanel اذهب إلى Node.js

```
hPanel → Advanced → Node.js Application → Create Application
```

#### الخطوة 2 — اضبط الإعدادات

| الإعداد | القيمة |
|---|---|
| Node.js Version | `20.x` |
| Application Root | `/home/USER/domains/data.expocore.net/public_html` |
| **Application Startup File** | `server/server.js` ← **مهم جداً** |
| **Start Command** | `npm start` |

#### الخطوة 3 — ربط GitHub

```
hPanel → Git → Create Repository
Repository URL : https://github.com/YOUR_USERNAME/dataCore.git
Branch         : main
Deploy Path    : /home/USER/domains/data.expocore.net/public_html
```

#### الخطوة 4 — Environment Variables في hPanel

```
hPanel → Websites → data.expocore.net → Environment Variables
```

أضف هذه المتغيرات (يجب إضافتها قبل أول deploy):

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://tddgfyxmublwqilfzmvx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | المفتاح الكامل |
| `GOOGLE_MAPS_API_KEY` | مفتاح Google Maps |
| `PORT` | `3000` |
| `NODE_ENV` | `production` |

> ⚠️ **مهم**: متغيرات `VITE_*` تحتاج أن تكون موجودة **وقت البناء** (build time) لأنها تُدمج في الكود. أضفها قبل الـ Deploy.

#### الخطوة 5 — Deploy وما يحدث تلقائياً

بعد كل `git push` لـ GitHub يتم تلقائياً:

```bash
npm install
# postinstall يشغّل: npm install --prefix server && vite build

npm start
# يشغّل: node server/server.js
```

السيرفر يقدم:
- الـ API على `/api/*`
- ملفات React من `dist/` على باقي المسارات

---

## 🔄 النشر على منصات أخرى

إذا واجهت صعوبة مع Hostinger Node.js، هذه بدائل ممتازة:

### 🚂 Railway (الأسهل — موصى به كبديل)

```
1. railway.app → New Project → Deploy from GitHub
2. اختر المستودع
3. أضف Environment Variables
4. Railway يكتشف Node.js تلقائياً ويشغل: npm start
```

### 🎨 Render

| الإعداد | القيمة |
|---|---|
| Build Command | `npm install` |
| Start Command | `npm start` |
| Environment | Node |

### 🌊 DigitalOcean App Platform

```yaml
name: datacore
services:
  - name: web
    github:
      repo: YOUR_USERNAME/dataCore
      branch: main
    run_command: npm start
    build_command: npm install
    environment_slug: node-js
    instance_size_slug: basic-xxs
```

---

## 🔧 حل المشاكل الشائعة

### ❌ الـ API يرجع 404 في production

**السبب**: المشروع منشور كـ Static Site بدون Backend.
**الحل**: غيّر إلى Node.js Application mode في hPanel.

---

### ❌ `VITE_SUPABASE_URL is not defined` في production

**السبب**: متغيرات `VITE_*` تحتاج وجودها **وقت البناء**.
**الحل**: أضف المتغيرات في hPanel → Environment Variables قبل الـ Deploy وأعد البناء.

---

### ❌ الـ Telegram لا يعمل

**الحل**: تأكد أن `server/scraped_folders/` موجود وقابل للكتابة على السيرفر.

---

### ❌ خطأ `cannot find module dotenv`

```bash
cd server && npm install dotenv
```

---

### ❌ CORS Error في production

تأكد أن `VITE_API_URL` في hPanel فارغ (empty) عند استخدام نفس السيرفر للـ frontend والـ backend.

---

## 📊 ملخص الأوامر

```bash
npm install      # تثبيت كل المكتبات (frontend + backend + build تلقائي)
npm run dev      # تشغيل frontend في وضع التطوير (port 5173)
npm start        # تشغيل الـ server الكامل في production (port 3000)
npm run build    # بناء frontend فقط
```

---

**Made with ❤️ — DataCore Pro**
