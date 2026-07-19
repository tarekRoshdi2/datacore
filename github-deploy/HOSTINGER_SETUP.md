# 🌐 إعداد Hostinger — الطريقة الصحيحة

## ⚠️ المشكلة في الإعداد الحالي

الإعداد الحالي على Hostinger يستخدم **Vite (Static Hosting)**:
- Root directory: `server` ← **خاطئ**
- Framework: `Vite` ← **خاطئ لهذا المشروع**

هذا يعني أن الـ Backend **لن يعمل** وكل الـ `/api/*` ستعطي 404.

---

## ✅ الإعداد الصحيح — Node.js Application

### في hPanel اتبع الخطوات:

#### 1. تعطيل الـ Vite Static Hosting الحالي
```
hPanel → Websites → data.expocore.net → Deployments
→ غيّر الإعداد أو احذف الـ deployment الحالي
```

#### 2. إنشاء Node.js Application
```
hPanel → Advanced → Node.js Application → Create Application
```

اضبط:
| الإعداد | القيمة الصحيحة |
|---|---|
| Node.js Version | `20.x` |
| Application Root | `/home/USER/domains/data.expocore.net/public_html` |
| **Application Startup File** | `server/server.js` |
| **Application URL** | `data.expocore.net` |

#### 3. إعداد Environment Variables
```
hPanel → Websites → data.expocore.net → Environment Variables
```

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://tddgfyxmublwqilfzmvx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | المفتاح الكامل |
| `GOOGLE_MAPS_API_KEY` | `AIzaSyBaeqVsZuiAKe7tPpHuFqBWj0LMPuXpp2c` |
| `PORT` | `3000` |
| `NODE_ENV` | `production` |

#### 4. ربط Git Repository
```
hPanel → Git → Create → Clone Repository
Repository: https://github.com/YOUR_USERNAME/dataCore.git
Branch: main
Path: /home/USER/domains/data.expocore.net/public_html
```

#### 5. تشغيل الـ Build يدوياً (أول مرة)
```bash
# SSH إلى السيرفر
ssh user@data.expocore.net

# الانتقال للمشروع
cd ~/domains/data.expocore.net/public_html

# تثبيت المكتبات وبناء الفرونت
npm install

# تشغيل السيرفر مع PM2
npm install -g pm2
pm2 start server/server.js --name datacore
pm2 save
pm2 startup
```

---

## 🔄 ماذا يحدث عند كل Deploy

```
git push → GitHub Actions → SSH إلى Hostinger → git pull → npm install → npm run build → pm2 restart
```

---

## ✅ التحقق من النجاح

```bash
# على السيرفر
pm2 status           # يجب أن يكون online
curl localhost:3000  # يجب أن يرد السيرفر

# من المتصفح
https://data.expocore.net/api/telegram/accounts
# يجب أن يرجع JSON وليس 404
```

---

## 🆚 مقارنة الخيارات

| | Vite Static (الحالي ❌) | Node.js App (الصحيح ✅) |
|---|---|---|
| Frontend | ✅ يعمل | ✅ يعمل |
| `/api/*` | ❌ 404 | ✅ يعمل |
| Telegram | ❌ | ✅ |
| Google Maps | ❌ | ✅ |
| Email | ❌ | ✅ |
| Web Scraping | ❌ | ✅ |
