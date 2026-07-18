# دليل رفع وتشغيل تطبيق DataScraperPro على Hostinger و GitHub

يقوم هذا الدليل بشرح الخطوات بالتفصيل لرفع الكود إلى GitHub ثم تشغيله على استضافة **Hostinger**.

---

## 1. رفع المشروع إلى GitHub (GitHub Setup)
بما أن بعض البيانات مثل حسابات تليجرام وجلسات تسجيل الدخول حساسة للغاية، فقد تم استبعادها تلقائياً من الرفع عبر ملف `.gitignore`.

لرفع الكود لأول مرة، يمكنك استخدام **VS Code** أو **Git Bash** كما يلي:

### الطريقة الأولى: باستخدام VS Code (أسهل طريقة)
1. افتح مجلد المشروع `DataScraperPro` في VS Code.
2. اذهب إلى علامة التبويب **Source Control** (شكل المتفرع) من القائمة الجانبية اليسرى (أو اضغط `Ctrl + Shift + G`).
3. اضغط على زر **Initialize Repository**.
4. اكتب رسالة الالتزام (مثلاً: `initial release for production`) ثم اضغط على زر **Commit**.
5. اضغط على زر **Publish Branch** ثم اختر **Publish to GitHub private repository** (يُفضل بشدة أن يكون المستودع خاصاً/Private لحماية الكود).
6. اتبع التعليمات لتسجيل الدخول إلى حساب GitHub الخاص بك وسيقوم VS Code بإنشاء المستودع ورفع الكود تلقائياً.

### الطريقة الثانية: باستخدام Git CLI (إذا كان مثبتاً)
افتح مبدل الأوامر في مجلد المشروع ونفذ:
```bash
git init
git add .
git commit -m "Configure project for Hostinger deployment"
# أنشئ مستودعاً جديداً على موقع GitHub ثم انسخ الرابط الخاص به ونفذ التالي:
git remote add origin <رابط_المستودع_على_github>
git branch -M main
git push -u origin main
```

---

## 2. إعداد استضافة Node.js على Hostinger
تأكد من أن خطة الاستضافة الخاصة بك في Hostinger تدعم Node.js (مثل خطط VPS أو الاستضافة السحابية المخصصة لـ Node.js).

### الخطوات في لوحة تحكم Hostinger:
1. قم بإنشاء تطبيق Node.js جديد من لوحة التحكم (hPanel) -> قسم **Advanced** -> **Node.js**.
2. قم بربط استضافة Hostinger بمستودع GitHub الخاص بك لسحب الكود تلقائياً (من لوحة تحكم Node.js ابحث عن **Git integration** أو قم برفع الملفات يدوياً عبر مدير الملفات File Manager إذا كنت تفضل ذلك).
3. اضبط خيارات التطبيق كالتالي:
   - **Node.js Version**: اختر إصدار حديث (مثلاً Node.js 18 أو 20).
   - **Application Entry File**: قم بتوجيهه إلى `server/server.js` (أو `server.js` إذا قمت بنقله، لكن مع إعدادنا الحالي الملف هو `server/server.js`).
   - **Run Command**: اتركها افتراضية أو اضبطها لتشغيل `npm start` (حيث قمنا بإضافة أمر `start` في ملف `package.json` الرئيسي).

---

## 3. إعداد المتغيرات البيئية (Environment Variables)
يحتاج التطبيق لمعرفة بيانات Supabase للعمل بشكل سليم. في لوحة تحكم Hostinger (أو داخل ملف `.env` في المجلد الرئيسي على الاستضافة)، أضف المتغيرات التالية:

```env
# إعدادات Supabase الخاصة بك
VITE_SUPABASE_URL=https://tddgfyxmublwqilfzmvx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZGdmeXhtdWJsd3FpbGZ6bXZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMjE1NzgsImV4cCI6MjA5ODU5NzU3OH0.-zrRh4rqzbqGua_4q7BFPf_8i7mCqva6HyjKaYaECDM

# المنفذ الذي سيعمل عليه السيرفر (يقوم Hostinger بتمريره تلقائياً عادةً)
PORT=3000
```

---

## 4. البناء والتشغيل الأول (Build & Start)
بعد سحب الكود على Hostinger:
1. قم بتشغيل تثبيت الحزم (npm install). بفضل التحديث الذي قمنا به، سيقوم السيرفر تلقائياً بتثبيت حزم الباك-إند والفرونت-إند معاً.
2. قم ببناء ملفات الفرونت-إند عن طريق تشغيل أمر البناء:
   ```bash
   npm run build
   ```
3. قم بتشغيل التطبيق (Start) من لوحة تحكم Hostinger. 

سيقوم سيرفر Express الآن بتقديم واجهة المستخدم React (المبنية داخل مجلد `dist`) عند زيارة الدومين الخاص بك، وسيعمل الـ API بشكل تلقائي ومتكامل على نفس الدومين دون أي مشاكل اتصال!
