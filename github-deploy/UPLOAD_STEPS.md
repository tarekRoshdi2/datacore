# 🚀 خطوات الرفع على GitHub — خطوة بخطوة

## المتطلبات الأولية

- تثبيت [Git](https://git-scm.com/downloads)
- حساب [GitHub](https://github.com)
- المشروع في `f:\AI\dataCore`

---

## الخطوة 1 — إنشاء Repository على GitHub

1. اذهب إلى [github.com/new](https://github.com/new)
2. اضبط الإعدادات:
   - **Repository name**: `dataCore`
   - **Visibility**: Private (موصى به لحماية الكود)
   - **لا تضغط** Add README أو .gitignore
3. اضغط **Create repository**
4. انسخ رابط الـ Repository

---

## الخطوة 2 — رفع المشروع

```bash
# في مجلد المشروع f:\AI\dataCore
cd f:\AI\dataCore

# تهيئة git (إذا لم يكن موجوداً)
git init

# إضافة جميع الملفات (سيستبعد .env تلقائياً)
git add .

# أول commit
git commit -m "feat: initial deployment setup"

# تغيير الفرع إلى main
git branch -M main

# ربط بـ GitHub (استبدل YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/dataCore.git

# رفع الكود
git push -u origin main
```

---

## الخطوة 3 — إضافة GitHub Secrets

```
GitHub → Repository → Settings → Secrets and variables → Actions
```

أضف هذه الـ Secrets (اطلع على GITHUB_SECRETS.md للتفاصيل):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `GOOGLE_MAPS_API_KEY`
- `HOSTINGER_HOST`
- `HOSTINGER_USERNAME`
- `HOSTINGER_SSH_KEY`

---

## الخطوة 4 — ربط Hostinger بـ GitHub

اختر أحد الخيارين:

### الخيار أ: Auto Deploy عبر GitHub Actions (موصى به)
- الـ Workflow في `.github/workflows/deploy.yml` يعمل تلقائياً مع كل `push`
- يحتاج SSH Key مضبوط (راجع GITHUB_SECRETS.md)

### الخيار ب: ربط يدوي من hPanel
```
hPanel → Websites → data.expocore.net → Git → Connect Repository
```

---

## الخطوة 5 — بعد كل تحديث

```bash
git add .
git commit -m "fix: وصف التغيير"
git push origin main
# الـ Workflow يشتغل تلقائياً ويعمل الـ deploy
```
