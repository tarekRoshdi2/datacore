# 📋 ملف إعدادات PM2 — ecosystem.config.js

## كيف تستخدمه

انسخ هذا الملف إلى جذر المشروع على السيرفر وشغّل:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

---

## محتوى الملف (ecosystem.config.cjs)

```js
module.exports = {
  apps: [
    {
      name: 'datacore',
      script: 'server/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
};
```

---

## أوامر PM2 المفيدة

```bash
pm2 list                    # عرض كل التطبيقات
pm2 status                  # حالة التطبيقات
pm2 restart datacore        # إعادة تشغيل
pm2 stop datacore           # إيقاف
pm2 logs datacore           # عرض اللوجات
pm2 logs datacore --lines 50  # آخر 50 سطر
pm2 monit                   # مراقبة live
pm2 startup                 # تشغيل تلقائي عند إعادة تشغيل السيرفر
pm2 save                    # حفظ الإعدادات
```
