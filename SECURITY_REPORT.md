# تقرير تأمين ماء ريسك — كلمة مرور المدير الثابتة

## بيانات الإقلاع
- البريد: `admin@maarisk.org`
- كلمة المرور الابتدائية: `Admin@123` (تُجزَّأ بـ bcrypt عند الإنشاء)
- `must_change_password=1` حتى أول تغيير ناجح

## تعديلات Backend (`backend/main.py`)
- إلغاء `secrets.token_urlsafe` وملف `.bootstrap_admin.txt` وطباعة Terminal
- إنشاء المدير مرة واحدة فقط إن لم يوجد
- `require_admin` يرفض الطلبات إذا `must_change_password=1` (حماية خادم، ليس واجهة فقط)
- `token_version` يبطل الجلسات بعد تغيير كلمة المرور

## اختبارات فعلية (نُفِّذت)
| # | الحالة | النتيجة |
|---|--------|---------|
| 1 | دخول Admin@123 على قاعدة جديدة | PASS |
| 2 | must_change_password=true | PASS |
| 3/4 | /admin/users قبل التغيير → 403 | PASS |
| 5 | تغيير كلمة المرور | PASS |
| 6 | دخول بالجديدة | PASS |
| 7 | رفض القديمة + إبطال التوكن | PASS |
| 8/9 | init_db لا يعيد Admin@123 | PASS |
| 10 | تسجيل مستخدم عادي | PASS |

## ملفات معدّلة
- `backend/main.py`
- `README.txt`
- `SECURITY_REPORT.md`
