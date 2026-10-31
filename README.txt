ماء ريسك | Mā’ Risk — v20 (SHARE-EbA)
=====================================

تشغيل الواجهة:
  cd maarisk && python3 -m http.server 8080

تشغيل الخادم (اختياري للمصادقة المركزية):
  cd maarisk/backend
  export MAARISK_SECRET="ضع-سرا-ثابتا-طويلا"
  pip install -r requirements.txt
  python3 -m uvicorn main:app --host 127.0.0.1 --port 8000

حساب المدير الابتدائي (مع خادم وقاعدة جديدة):
  admin@maarisk.org / Admin@123
  يُفرض تغيير كلمة المرور عند أول دخول.

بدون خادم: المصادقة المحلية تعمل في المتصفح (عرض).
مجموعات البيانات: DataHub (localStorage + محاولة IndexedDB).

راجع:
  V20_CHANGELOG.md — الإصلاحات
  COMPOSITE_ENGINE_REPORT.md — المؤشرات المركبة
  MAPS_FIX_REPORT.md — الخرائط
  SPI_GAUGE_REPORT.md — مقياس SPI
