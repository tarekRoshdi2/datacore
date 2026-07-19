# 📋 دليل إعداد GitHub Secrets

## الـ Secrets المطلوبة في GitHub Repository

اذهب إلى:
```
GitHub → Repository → Settings → Secrets and variables → Actions → New repository secret
```

أضف هذه الـ Secrets واحدة واحدة:

---

### 🔑 Supabase

| Secret Name | القيمة |
|---|---|
| `VITE_SUPABASE_URL` | `https://tddgfyxmublwqilfzmvx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | المفتاح الكامل من Supabase Dashboard |

---

### 🗺️ Google Maps

| Secret Name | القيمة |
|---|---|
| `GOOGLE_MAPS_API_KEY` | مفتاح Google Maps Places API |

---

### 🖥️ Hostinger SSH (للـ Auto Deploy)

| Secret Name | القيمة | كيف تحصل عليها |
|---|---|---|
| `HOSTINGER_HOST` | IP السيرفر | hPanel → VPS → Server IP |
| `HOSTINGER_USERNAME` | اسم المستخدم SSH | hPanel → VPS → SSH Access |
| `HOSTINGER_SSH_KEY` | المفتاح الخاص (private key) | أنشئه بـ `ssh-keygen` |
| `HOSTINGER_PORT` | `22` (افتراضي) | - |

---

### 🔧 اختياري

| Secret Name | القيمة |
|---|---|
| `VITE_API_URL` | فارغ إذا backend وfrontend على نفس السيرفر |

---

## 🔐 كيف تنشئ SSH Key للـ Hostinger

```bash
# على جهازك المحلي
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/hostinger_deploy

# انسخ المفتاح العام للسيرفر
cat ~/.ssh/hostinger_deploy.pub
# أضفه في: hPanel → SSH Access → Authorized Keys

# المفتاح الخاص (هذا يُضاف في GitHub Secrets)
cat ~/.ssh/hostinger_deploy
```

---

## ✅ التحقق من عمل الـ Workflow

بعد الضغط على `git push origin main`:
1. اذهب إلى GitHub → Repository → Actions
2. ستجد الـ workflow يعمل تلقائياً
3. إذا اخضر ✅ = النشر نجح
4. إذا احمر ❌ = اضغط عليه لتعرف الخطأ
