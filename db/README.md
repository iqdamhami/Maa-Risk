# بنية قاعدة البيانات وواجهات API — ماء ريسك

## المحرك المقترح

| المكوّن | الاختيار | السبب |
|---------|----------|--------|
| قاعدة البيانات | **PostgreSQL 15+** | موثوقية، JSONB، قيود قوية |
| الامتداد المكاني | **PostGIS** | طبقات GIS، نقاط، مضلعات، فهارس GIST |
| تجزئة كلمات المرور | Argon2id أو bcrypt | معيار أمني قوي |
| الملفات | تخزين كائنات (S3/MinIO) + مسار في DB | فصل الملفات عن الصفوف |

---

## مخطط الكيانات والعلاقات (ملخص)

```
users 1──* projects (owner)
users *──* projects          عبر project_members
projects 1──* datasets
datasets 1──* time_series_observations
datasets 1──* tabular_records
projects 1──* risk_analyses
risk_analyses 1──* risk_zone_scores
solution_catalog 1──* project_solutions *──1 projects
projects 1──* cost_estimates
projects 1──* investment_proposals
projects 1──* reports
users 1──* activity_log
```

### الوحدات الست ← الجداول

| الوحدة | الجداول الرئيسية |
|--------|------------------|
| 1 البيانات | `datasets`, `time_series_observations`, `tabular_records` |
| 2 المخاطر | `risk_analyses`, `risk_zone_scores` |
| 3 الخرائط | `risk_zone_scores.geom` + `tabular_records.geom` (PostGIS) |
| 4 الحلول | `solution_catalog`, `project_solutions` |
| 5 التكاليف | `cost_estimates`, `investment_proposals` |
| 6 التقارير | `reports` |

---

## الملفات في هذا المجلد

- `schema.sql` — إنشاء الامتدادات، كل الجداول، الفهارس، المحفّزات، وبذر كتالوج الحلول

---

## تشغيل سريع (محلي)

```bash
# إنشاء قاعدة
createdb maarisk
psql maarisk -c "CREATE EXTENSION postgis;"
psql maarisk -f schema.sql
```

---

## مبادئ تصميم مهمة

1. **UUID** كمفاتيح أساسية لتسهيل الدمج والتوزيع.
2. **حذف متسلسل محسوب**: حذف المشروع يحذف بياناته وتحليلاته؛ المستخدم لا يُحذف إن كان مالكاً (RESTRICT).
3. **JSONB** للتوقعات، عدم اليقين، ومحتوى التقارير دون تشتيت الجداول.
4. **هندسة مكانية 4326 (WGS84)** مع فهارس GIST للاستعلامات الجغرافية.
5. **سجل نشاط** (`activity_log`) للتدقيق دون تعقيد الجداول الأساسية.
6. **أدوار المستخدم**: admin / planner / analyst / funder / viewer.

---

## واجهات API

المواصفات الكاملة: `../api/openapi.yaml` (OpenAPI 3).

### مجموعات المسارات

| المجموعة | أمثلة |
|----------|--------|
| Auth | `POST /auth/register`, `/login`, `/refresh`, `/logout` |
| Projects | `GET/POST /projects`, `GET/PATCH/DELETE /projects/{id}` |
| Datasets | `GET/POST /projects/{id}/datasets`, `POST .../demo` |
| Risk | `POST /projects/{id}/risk-analyses`, `GET .../{analysisId}` |
| Maps | `GET /projects/{id}/zones?format=geojson` |
| Solutions | `GET /solutions/catalog`, `GET/PUT /projects/{id}/solutions` |
| Costing | `POST /projects/{id}/cost-estimates`, `POST .../proposals` |
| Reports | `POST /projects/{id}/reports`, `GET .../download` |

### المصادقة

- Access Token (JWT قصير العمر) في ترويسة `Authorization: Bearer ...`
- Refresh Token يُخزَّن مجزّأً في `refresh_tokens` ويمكن إبطاله عند الخروج

### أكواد الاستجابة الشائعة

- `201` إنشاء · `202` عملية غير متزامنة (تحليل / تقرير)
- `400` تحقق · `401` غير مصرّح · `403` ممنوع · `404` غير موجود · `409` تعارض (بريد مكرر)

---

## ملاحظات للإنتاج

- لا تخزّن كلمات مرور نصية أبداً.
- ارفع الملفات عبر رابط موقّع أو خدمة تخزين منفصلة.
- شغّل تحليل المخاطر وتوليد التقارير في طابور مهام (Celery / RQ / Bull).
- فعّل RLS (Row Level Security) في PostgreSQL إن لزم عزل بيانات المؤسسات.
- انسخ احتياطياً يومياً + نقطة استعادة مكانية إن استخدمت طبقات كبيرة.
