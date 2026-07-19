# 📁 github-deploy — فولدر النشر الاحترافي

هذا الفولدر يحتوي على جميع الأدلة والإعدادات المطلوبة لرفع المشروع على GitHub ونشره على Hostinger.

---

## 📄 الملفات

| الملف | الوصف |
|---|---|
| [UPLOAD_STEPS.md](./UPLOAD_STEPS.md) | خطوات رفع المشروع على GitHub |
| [GITHUB_SECRETS.md](./GITHUB_SECRETS.md) | إعداد GitHub Secrets للـ CI/CD |
| [HOSTINGER_SETUP.md](./HOSTINGER_SETUP.md) | إعداد Hostinger بالطريقة الصحيحة (Node.js) |
| [PM2_SETUP.md](./PM2_SETUP.md) | إعداد PM2 لإبقاء السيرفر يعمل 24/7 |

---

## 🚀 الترتيب الموصى به

```
1. UPLOAD_STEPS.md     → ارفع الكود على GitHub أولاً
2. GITHUB_SECRETS.md   → أضف الـ Secrets
3. HOSTINGER_SETUP.md  → اضبط Hostinger بالطريقة الصحيحة
4. PM2_SETUP.md        → شغّل السيرفر بـ PM2
```

---

## ⚡ ملفات في جذر المشروع تحتاجها للنشر

| الملف | الوصف |
|---|---|
| `.github/workflows/deploy.yml` | GitHub Actions للنشر التلقائي |
| `ecosystem.config.cjs` | إعدادات PM2 |
| `.env.example` | نموذج المتغيرات البيئية |
| `README.md` | توثيق المشروع الكامل |
