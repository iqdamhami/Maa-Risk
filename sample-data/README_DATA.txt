نموذج بيانات منصة ماء ريسك
========================

الملف: climate_env_geo_template.csv

يمثل شكلاً مقترحاً لبيانات يمكن رفعها للمنصة، وتشمل:

1) عوامل مناخية
   - rainfall_mm : هطول شهري (مم)
   - avg_temp_c / max_temp_c / min_temp_c : درجات الحرارة
   - spi_3month / spei_3month : مؤشرات جفاف
   - drought_class : تصنيف الجفاف (normal/mild/moderate/severe/extreme)

2) عوامل مائية وبيئية
   - groundwater_level_m : منسوب المياه الجوفية
   - surface_water_m3 : المياه السطحية المتاحة
   - land_cover : الغطاء الأرضي
   - soil_type : نوع التربة

3) عوامل جغرافية ومكانية
   - latitude / longitude
   - elevation_m / slope_pct
   - region_id / region_name

4) عوامل سكانية وصحية مرتبطة بالمناخ
   - population / pop_density_km2
   - access_to_safe_water_pct
   - diarrhea_cases_per_1000
   - malnutrition_rate_pct
   - priority_score : مؤشر أولوية مركّب (0–1)

الصيغ المدعومة للرفع في الواجهة التجريبية:
CSV · Excel · GeoJSON · Shapefile · NetCDF

يمكن استخدام هذا الملف كنقطة بداية بعد تعديله لبيانات منطقتك.
