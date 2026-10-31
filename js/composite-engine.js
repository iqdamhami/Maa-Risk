/**
 * Mā’ Risk — محرك المؤشرات المركبة (Composite Risk Engine)
 * منهجية: درجات معيارية 0–1 × أوزان نسبية → درجة أساسية → معاملات تعديل → مؤشر 0–100
 * مستوحى من مبادئ منصات التقييم متعدد المعايير (بما فيها Yarmouk Climate & Health Risk Lab)
 * مع أوزان مستقلة لكل مؤشر وليست نسخاً حرفية من مختبر آخر.
 *
 * لا يستبدل محرك التحليل الحالي؛ يُستدعى كطبقة إضافية شفافة.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'maarisk_composite_models_v1';
  const ACTIVE_KEY = 'maarisk_composite_active_v1';

  /** تصنيف الخطر من 0–100 */
  function classify(score100) {
    if (score100 >= 80) return { level: 'critical', ar: 'حرج', en: 'Critical', fr: 'Critique', color: '#C23B22' };
    if (score100 >= 60) return { level: 'high', ar: 'مرتفع', en: 'High', fr: 'Élevé', color: '#E07A3D' };
    if (score100 >= 40) return { level: 'moderate', ar: 'متوسط', en: 'Moderate', fr: 'Modéré', color: '#C4A574' };
    if (score100 >= 20) return { level: 'low', ar: 'منخفض', en: 'Low', fr: 'Faible', color: '#3A7CA5' };
    return { level: 'very_low', ar: 'منخفض جداً', en: 'Very low', fr: 'Très faible', color: '#2A9D8F' };
  }

  /**
   * مصفوفات أوزان افتراضية (مجموع كل مصفوفة = 1.0)
   * المصادر: توافق IPCC risk framing، مؤشرات SPI/SPEI، ضغط مائي، أدبيات الهشاشة
   * confidence: high | medium | low
   */
  const DEFAULT_MATRICES = {
    drought: {
      id: 'drought',
      name: { ar: 'مؤشر الجفاف', en: 'Drought index', fr: 'Indice de sécheresse' },
      version: '1.0-default',
      adopted_at: '2026-01-15',
      status: 'default',
      weights: {
        precip_deficit: { w: 0.30, label: { ar: 'عجز الهطول', en: 'Precipitation deficit', fr: 'Déficit pluviométrique' }, source: 'SPI/SPEI literature', confidence: 'high' },
        spi: { w: 0.25, label: { ar: 'مؤشر SPI', en: 'SPI', fr: 'SPI' }, source: 'McKee et al. standardized anomaly', confidence: 'high' },
        temp_anomaly: { w: 0.15, label: { ar: 'شذوذ الحرارة', en: 'Temperature anomaly', fr: 'Anomalie de température' }, source: 'Evaporative demand proxy', confidence: 'medium' },
        soil_moisture: { w: 0.15, label: { ar: 'رطوبة التربة (وكيل)', en: 'Soil moisture proxy', fr: 'Humidité du sol (proxy)' }, source: 'Balance residual', confidence: 'medium' },
        duration: { w: 0.15, label: { ar: 'مدة الجفاف', en: 'Drought duration', fr: 'Durée de sécheresse' }, source: 'Event length weighting', confidence: 'medium' }
      }
    },
    water_scarcity: {
      id: 'water_scarcity',
      name: { ar: 'مؤشر شح المياه', en: 'Water scarcity', fr: 'Rareté de l’eau' },
      version: '1.0-default',
      adopted_at: '2026-01-15',
      status: 'default',
      weights: {
        water_gap: { w: 0.28, label: { ar: 'فجوة العرض–الطلب', en: 'Supply–demand gap', fr: 'Écart offre–demande' }, source: 'Water balance', confidence: 'high' },
        availability: { w: 0.22, label: { ar: 'التوافر المائي', en: 'Water availability', fr: 'Disponibilité' }, source: 'Runoff/GW proxy', confidence: 'high' },
        demand_pressure: { w: 0.18, label: { ar: 'ضغط الطلب', en: 'Demand pressure', fr: 'Pression de la demande' }, source: 'Population & sector demand', confidence: 'medium' },
        access: { w: 0.16, label: { ar: 'ضعف الوصول', en: 'Access deficit', fr: 'Déficit d’accès' }, source: 'Service coverage inverse', confidence: 'medium' },
        quality_stress: { w: 0.16, label: { ar: 'إجهاد الجودة', en: 'Quality stress', fr: 'Stress qualité' }, source: 'Qualitative proxy', confidence: 'low' }
      }
    },
    flood: {
      id: 'flood',
      name: { ar: 'مؤشر الفيضانات', en: 'Flood index', fr: 'Indice d’inondation' },
      version: '1.0-default',
      adopted_at: '2026-01-15',
      status: 'default',
      weights: {
        extreme_precip: { w: 0.32, label: { ar: 'هطول متطرف', en: 'Extreme precipitation', fr: 'Précipitations extrêmes' }, source: 'Rx1day / percentiles', confidence: 'high' },
        runoff_potential: { w: 0.22, label: { ar: 'كمون الجريان', en: 'Runoff potential', fr: 'Potentiel de ruissellement' }, source: 'Intensity vs infiltration', confidence: 'medium' },
        exposure_lowland: { w: 0.20, label: { ar: 'تعرّض منخفضات', en: 'Lowland exposure', fr: 'Exposition bas-fonds' }, source: 'Spatial proxy', confidence: 'medium' },
        drainage: { w: 0.14, label: { ar: 'ضعف الصرف', en: 'Drainage deficit', fr: 'Déficit de drainage' }, source: 'Infrastructure inverse', confidence: 'low' },
        antecedent_wet: { w: 0.12, label: { ar: 'رطوبة سابقة', en: 'Antecedent wetness', fr: 'Humidité antérieure' }, source: 'Short-term accumulation', confidence: 'medium' }
      }
    },
    heat_stress: {
      id: 'heat_stress',
      name: { ar: 'مؤشر الإجهاد الحراري', en: 'Heat stress', fr: 'Stress thermique' },
      version: '1.0-default',
      adopted_at: '2026-01-15',
      status: 'default',
      weights: {
        tmax: { w: 0.30, label: { ar: 'درجات الحرارة القصوى', en: 'Max temperature', fr: 'Température max' }, source: 'Heat index inputs', confidence: 'high' },
        heatwave_days: { w: 0.25, label: { ar: 'أيام الموجة الحارة', en: 'Heatwave days', fr: 'Jours de canicule' }, source: 'Threshold exceedance', confidence: 'high' },
        night_temp: { w: 0.20, label: { ar: 'حرارة ليلية', en: 'Night temperature', fr: 'Température nocturne' }, source: 'Recovery deficit', confidence: 'medium' },
        humidity_proxy: { w: 0.15, label: { ar: 'رطوبة نسبية (وكيل)', en: 'Humidity proxy', fr: 'Humidité (proxy)' }, source: 'Comfort index', confidence: 'medium' },
        urban_heat: { w: 0.10, label: { ar: 'جزيرة حرارية حضرية', en: 'Urban heat', fr: 'Îlot de chaleur' }, source: 'Density proxy', confidence: 'low' }
      }
    },
    climate_risk: {
      id: 'climate_risk',
      name: { ar: 'مؤشر المخاطر المناخية', en: 'Climate risk', fr: 'Risque climatique' },
      version: '1.0-default',
      adopted_at: '2026-01-15',
      status: 'default',
      weights: {
        drought_c: { w: 0.22, label: { ar: 'مركّب الجفاف', en: 'Drought composite', fr: 'Composite sécheresse' }, source: 'Nested drought index', confidence: 'high' },
        water_c: { w: 0.22, label: { ar: 'مركّب الشح', en: 'Scarcity composite', fr: 'Composite rareté' }, source: 'Nested scarcity', confidence: 'high' },
        heat_c: { w: 0.18, label: { ar: 'مركّب الحر', en: 'Heat composite', fr: 'Composite chaleur' }, source: 'Nested heat', confidence: 'medium' },
        flood_c: { w: 0.15, label: { ar: 'مركّب الفيضان', en: 'Flood composite', fr: 'Composite inondation' }, source: 'Nested flood', confidence: 'medium' },
        variability: { w: 0.13, label: { ar: 'تقلبية مناخية', en: 'Climate variability', fr: 'Variabilité climatique' }, source: 'CV of series', confidence: 'medium' },
        trend_stress: { w: 0.10, label: { ar: 'اتجاه طويل الأمد', en: 'Long-term trend', fr: 'Tendance long terme' }, source: 'Linear trend stress', confidence: 'low' }
      }
    },
    eco_social_vuln: {
      id: 'eco_social_vuln',
      name: { ar: 'الهشاشة البيئية والمجتمعية', en: 'Eco-social vulnerability', fr: 'Vulnérabilité éco-sociale' },
      version: '1.0-default',
      adopted_at: '2026-01-15',
      status: 'default',
      weights: {
        poverty: { w: 0.20, label: { ar: 'هشاشة اقتصادية', en: 'Economic vulnerability', fr: 'Vulnérabilité économique' }, source: 'Socio proxy', confidence: 'medium' },
        dependency_ratio: { w: 0.15, label: { ar: 'التركيب الديموغرافي', en: 'Demographic dependency', fr: 'Dépendance démographique' }, source: 'Age structure proxy', confidence: 'medium' },
        ecosystem_degrade: { w: 0.18, label: { ar: 'تدهور النظم البيئية', en: 'Ecosystem degradation', fr: 'Dégradation des écosystèmes' }, source: 'Land/vegetation proxy', confidence: 'medium' },
        service_access: { w: 0.17, label: { ar: 'ضعف الخدمات', en: 'Service access deficit', fr: 'Déficit de services' }, source: 'Health/water access', confidence: 'medium' },
        livelihood_climate: { w: 0.15, label: { ar: 'اعتماد سبل العيش على المناخ', en: 'Climate-sensitive livelihoods', fr: 'Moyens de subsistance climatiques' }, source: 'Agro-pastoral share', confidence: 'medium' },
        displacement: { w: 0.15, label: { ar: 'ضغط النزوح/الاستضافة', en: 'Displacement pressure', fr: 'Pression de déplacement' }, source: 'Host community load', confidence: 'low' }
      }
    },
    climate_health: {
      id: 'climate_health',
      name: { ar: 'المخاطر المناخية–الصحية', en: 'Climate–health risk', fr: 'Risque climat–santé' },
      version: '1.0-default',
      adopted_at: '2026-01-15',
      status: 'default',
      weights: {
        heat_health: { w: 0.22, label: { ar: 'مسار الإجهاد الحراري', en: 'Heat–health pathway', fr: 'Voie chaleur–santé' }, source: 'Heat morbidity literature', confidence: 'high' },
        waterborne: { w: 0.22, label: { ar: 'أمراض منقولة بالمياه', en: 'Waterborne risk', fr: 'Risque hydrique' }, source: 'WASH & climate link', confidence: 'high' },
        drought_health: { w: 0.16, label: { ar: 'مسار الجفاف–التغذية/الغبار', en: 'Drought–health pathway', fr: 'Voie sécheresse–santé' }, source: 'Secondary health impacts', confidence: 'medium' },
        vector_proxy: { w: 0.12, label: { ar: 'بيئة نواقل (وكيل)', en: 'Vector environment proxy', fr: 'Environnement vectoriel' }, source: 'Temp/humidity suitability', confidence: 'low' },
        health_system: { w: 0.14, label: { ar: 'ضعف النظام الصحي', en: 'Health system gap', fr: 'Faiblesse du système de santé' }, source: 'Capacity inverse', confidence: 'medium' },
        exposure_pop: { w: 0.14, label: { ar: 'تعرّض سكاني', en: 'Population exposure', fr: 'Exposition démographique' }, source: 'Density × hazard', confidence: 'medium' }
      }
    }
  };

  /**
   * معاملات التعديل — تُطبَّق بعد الدرجة الأساسية.
   * اتجاه: amplify يزيد الخطر، buffer يخفضه.
   * لا تُدرج عوامل مكررة مع أوزان المصفوفة لنفس المؤشر.
   */
  const DEFAULT_ADJUSTMENTS = {
    population_fragility: { value: 1.0, min: 0.85, max: 1.25, direction: 'amplify', label: { ar: 'هشاشة السكان', en: 'Population fragility', fr: 'Fragilité démographique' }, note: 'يُستخدم فقط كمعامل تعديل، لا كعامل وزن مكرر' },
    exposure_duration: { value: 1.0, min: 0.9, max: 1.2, direction: 'amplify', label: { ar: 'مدة/شدة التعرض', en: 'Exposure duration/intensity', fr: 'Durée/intensité d’exposition' }, note: 'مضاعف زمني' },
    spatial_density: { value: 1.0, min: 0.9, max: 1.2, direction: 'amplify', label: { ar: 'كثافة مكانية', en: 'Spatial density', fr: 'Densité spatiale' }, note: 'تعرّض مكاني' },
    adaptive_capacity: { value: 1.0, min: 0.75, max: 1.15, direction: 'buffer', label: { ar: 'القدرة على التكيف', en: 'Adaptive capacity', fr: 'Capacité d’adaptation' }, note: 'قيم أعلى → تخفيض الخطر' },
    institutional_capacity: { value: 1.0, min: 0.8, max: 1.15, direction: 'buffer', label: { ar: 'قدرة مؤسسية/بنية تحتية', en: 'Institutional capacity', fr: 'Capacité institutionnelle' }, note: 'قيم أعلى → تخفيض' },
    water_alternatives: { value: 1.0, min: 0.8, max: 1.15, direction: 'buffer', label: { ar: 'توافر بدائل مائية', en: 'Water alternatives', fr: 'Alternatives hydriques' }, note: 'قيم أعلى → تخفيض' }
  };

  function clamp01(x) {
    x = Number(x);
    if (!isFinite(x)) return 0;
    return Math.max(0, Math.min(1, x));
  }

  function sumWeights(matrix) {
    return Object.values(matrix.weights).reduce((s, o) => s + Number(o.w || 0), 0);
  }

  function normalizeWeights(matrix) {
    const s = sumWeights(matrix);
    if (s <= 0) throw new Error('مجموع الأوزان صفر');
    const out = JSON.parse(JSON.stringify(matrix));
    Object.keys(out.weights).forEach(k => {
      out.weights[k].w = out.weights[k].w / s;
    });
    return out;
  }

  function validateMatrix(matrix) {
    const s = sumWeights(matrix);
    const ok = Math.abs(s - 1) < 1e-6 || Math.abs(s - 100) < 1e-6;
    return { ok, sum: s, normalized_sum: s > 1.5 ? s / 100 : s };
  }

  /** تطبيع عامل خام إلى 0–1 حسب اتجاه الخطر */
  function standardizeFactor(raw, meta) {
    // meta: { min, max, higherIsRisk: true }
    const min = meta.min != null ? meta.min : 0;
    const max = meta.max != null ? meta.max : 1;
    let v = clamp01((Number(raw) - min) / (max - min || 1));
    if (meta.higherIsRisk === false) v = 1 - v;
    return v;
  }

  /**
   * حساب مؤشر واحد
   * @param {string} indexId
   * @param {Object} factors - قيم 0–1 أو خام مع schema
   * @param {Object} options - { matrix, adjustments, factorMeta }
   */
  function computeIndex(indexId, factors, options) {
    options = options || {};
    const models = loadModels();
    let matrix = options.matrix || (models.matrices && models.matrices[indexId]) || DEFAULT_MATRICES[indexId];
    if (!matrix) throw new Error('مؤشر غير معروف: ' + indexId);

    const v = validateMatrix(matrix);
    if (!v.ok && Math.abs(v.normalized_sum - 1) > 0.02) {
      matrix = normalizeWeights(matrix);
    } else if (v.sum > 1.5) {
      matrix = normalizeWeights(Object.assign({}, matrix, {
        weights: Object.fromEntries(Object.entries(matrix.weights).map(([k, o]) => [k, Object.assign({}, o, { w: o.w / 100 })]))
      }));
    }

    const contributions = [];
    let base = 0;
    Object.keys(matrix.weights).forEach(key => {
      const wObj = matrix.weights[key];
      let score = factors[key];
      if (score == null && options.factorMeta && options.factorMeta[key] && factors[key + '_raw'] != null) {
        score = standardizeFactor(factors[key + '_raw'], options.factorMeta[key]);
      }
      score = clamp01(score == null ? 0 : score);
      const contrib = score * wObj.w;
      base += contrib;
      contributions.push({
        key,
        label: wObj.label,
        weight: wObj.w,
        score,
        contribution: contrib,
        source: wObj.source,
        confidence: wObj.confidence
      });
    });

    const adj = Object.assign({}, DEFAULT_ADJUSTMENTS, models.adjustments || {}, options.adjustments || {});
    let multiplier = 1;
    const adjApplied = [];
    Object.keys(adj).forEach(k => {
      const a = adj[k];
      let val = Number(a.value);
      if (!isFinite(val)) val = 1;
      val = Math.max(a.min, Math.min(a.max, val));
      // buffer: capacity 1.0 neutral; >1 reduces risk → multiply by (2 - val) capped
      let m = val;
      if (a.direction === 'buffer') {
        // value 1.0 → 1.0; 1.15 → ~0.85; 0.8 → ~1.2
        m = 2 - val;
      }
      multiplier *= m;
      adjApplied.push({ key: k, label: a.label, value: val, multiplier: m, direction: a.direction, note: a.note });
    });

    const adjusted = clamp01(base * multiplier);
    const score100 = Math.round(adjusted * 1000) / 10; // one decimal
    const cls = classify(score100);

    return {
      indexId,
      name: matrix.name,
      version: matrix.version,
      status: matrix.status || 'default',
      base_score: Math.round(base * 1000) / 1000,
      adjustment_multiplier: Math.round(multiplier * 1000) / 1000,
      final_0_1: adjusted,
      final_0_100: score100,
      classification: cls,
      contributions,
      adjustments: adjApplied,
      disclaimer: {
        ar: 'مؤشر تحليلي للقرار — ليس تصنيفاً رسمياً ولا تنبؤاً مؤكداً قبل المعايرة المحلية.',
        en: 'Decision-support index — not an official rating or confirmed forecast before local calibration.',
        fr: 'Indice d’aide à la décision — ni classement officiel ni prévision confirmée avant calibration locale.'
      }
    };
  }

  /** عوامل افتراضية من مخرجات التحليل الحالي إن وُجدت */
  function factorsFromAnalysis(analysisResult, region) {
    const r = region || {};
    const spi = analysisResult && analysisResult.spi && analysisResult.spi.latest != null
      ? analysisResult.spi.latest : (r.drought != null ? -r.drought * 2 : 0);
    // SPI سلبي = جفاف → درجة خطر
    const spiRisk = clamp01((-spi) / 2.5);
    const deficit = r.water != null ? clamp01(r.water) : (analysisResult && analysisResult.waterBalance
      ? clamp01(analysisResult.waterBalance.meanDeficit || 0.5) : 0.5);
    const health = r.health != null ? clamp01(r.health) : 0.5;
    const density = r.density != null ? clamp01(r.density / 120) : 0.3;
    const accessRisk = r.access != null ? clamp01((100 - r.access) / 100) : 0.4;

    return {
      // drought matrix keys
      precip_deficit: deficit,
      spi: spiRisk,
      temp_anomaly: clamp01((r.heat || 0.4)),
      soil_moisture: clamp01(0.4 + deficit * 0.4),
      duration: clamp01(r.drought || 0.5),
      // water scarcity
      water_gap: deficit,
      availability: clamp01(1 - deficit),
      demand_pressure: density,
      access: accessRisk,
      quality_stress: clamp01(health * 0.7 + accessRisk * 0.3),
      // flood
      extreme_precip: clamp01(r.flood || 0.25),
      runoff_potential: clamp01((r.flood || 0.25) * 0.8 + 0.1),
      exposure_lowland: clamp01(r.lowland || 0.3),
      drainage: clamp01(1 - (r.infra || 0.5)),
      antecedent_wet: clamp01(r.wet || 0.3),
      // heat
      tmax: clamp01(r.heat || 0.45),
      heatwave_days: clamp01(r.heat || 0.4),
      night_temp: clamp01((r.heat || 0.4) * 0.9),
      humidity_proxy: 0.4,
      urban_heat: density,
      // nested climate risk placeholders filled after sub-indices
      variability: 0.45,
      trend_stress: 0.4,
      // eco-social
      poverty: clamp01(r.poverty || 0.5),
      dependency_ratio: 0.4,
      ecosystem_degrade: clamp01(r.drought || 0.5),
      service_access: accessRisk,
      livelihood_climate: clamp01(r.agri || 0.55),
      displacement: clamp01(r.displacement || 0.35),
      // climate-health
      heat_health: clamp01(r.heat || 0.45),
      waterborne: clamp01(health),
      drought_health: spiRisk,
      vector_proxy: 0.35,
      health_system: clamp01(1 - (r.health_cap || 0.5)),
      exposure_pop: density
    };
  }

  function computeAll(analysisResult, region, options) {
    const factors = factorsFromAnalysis(analysisResult, region);
    const drought = computeIndex('drought', factors, options);
    const water = computeIndex('water_scarcity', factors, options);
    const flood = computeIndex('flood', factors, options);
    const heat = computeIndex('heat_stress', factors, options);

    // تعبئة المركّبات الفرعية لمؤشر المناخ
    factors.drought_c = drought.final_0_1;
    factors.water_c = water.final_0_1;
    factors.heat_c = heat.final_0_1;
    factors.flood_c = flood.final_0_1;

    const climate = computeIndex('climate_risk', factors, options);
    const vuln = computeIndex('eco_social_vuln', factors, options);
    const climHealth = computeIndex('climate_health', factors, options);

    return {
      region: region || null,
      indices: {
        drought, water_scarcity: water, flood, heat_stress: heat,
        climate_risk: climate, eco_social_vuln: vuln, climate_health: climHealth
      },
      generated_at: new Date().toISOString()
    };
  }

  /** تحليل حساسية: ±delta على وزن واحد مع إعادة تطبيع */
  function sensitivity(indexId, factors, weightKey, delta, options) {
    const models = loadModels();
    const baseMatrix = JSON.parse(JSON.stringify(
      (models.matrices && models.matrices[indexId]) || DEFAULT_MATRICES[indexId]
    ));
    const base = computeIndex(indexId, factors, Object.assign({}, options, { matrix: baseMatrix }));
    if (!baseMatrix.weights[weightKey]) return { error: 'weight key missing' };
    baseMatrix.weights[weightKey].w = Math.max(0.01, baseMatrix.weights[weightKey].w + delta);
    const norm = normalizeWeights(baseMatrix);
    const alt = computeIndex(indexId, factors, Object.assign({}, options, { matrix: norm }));
    return {
      weightKey,
      delta,
      base_score: base.final_0_100,
      alt_score: alt.final_0_100,
      change: Math.round((alt.final_0_100 - base.final_0_100) * 10) / 10
    };
  }

  function loadModels() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { matrices: null, adjustments: null, versions: [] };
      return JSON.parse(raw);
    } catch (e) {
      return { matrices: null, adjustments: null, versions: [] };
    }
  }

  function saveModels(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getDefaultMatrices() {
    return JSON.parse(JSON.stringify(DEFAULT_MATRICES));
  }

  function getDefaultAdjustments() {
    return JSON.parse(JSON.stringify(DEFAULT_ADJUSTMENTS));
  }

  /** اختبارات رياضية */
  function runSelfTests() {
    const results = [];
    Object.keys(DEFAULT_MATRICES).forEach(id => {
      const v = validateMatrix(DEFAULT_MATRICES[id]);
      const sumOk = Math.abs(v.normalized_sum - 1) < 1e-9 || Math.abs(v.sum - 1) < 1e-6;
      results.push({ test: 'weight_sum_' + id, pass: sumOk, sum: v.sum });
    });
    const f = factorsFromAnalysis(null, { water: 0.8, drought: 0.7, health: 0.6, density: 40, access: 50, heat: 0.5 });
    const all = computeAll(null, { water: 0.8, drought: 0.7, health: 0.6, density: 40, access: 50, heat: 0.5 });
    results.push({ test: 'compute_all_keys', pass: Object.keys(all.indices).length === 7 });
    const d = all.indices.drought;
    results.push({ test: 'score_range', pass: d.final_0_100 >= 0 && d.final_0_100 <= 100 });
    results.push({ test: 'base_before_adj', pass: d.base_score >= 0 && d.base_score <= 1 });
    // اتجاه buffer: زيادة القدرة تخفض النتيجة
    const lowCap = computeIndex('drought', f, { adjustments: { adaptive_capacity: { value: 0.85, min: 0.75, max: 1.15, direction: 'buffer', label: {}, note: '' } } });
    const highCap = computeIndex('drought', f, { adjustments: { adaptive_capacity: { value: 1.15, min: 0.75, max: 1.15, direction: 'buffer', label: {}, note: '' } } });
    results.push({ test: 'buffer_direction', pass: highCap.final_0_100 <= lowCap.final_0_100 });
    // ثبات
    const a1 = computeIndex('water_scarcity', f);
    const a2 = computeIndex('water_scarcity', f);
    results.push({ test: 'stability', pass: a1.final_0_100 === a2.final_0_100 });
    // حساسية
    const sens = sensitivity('drought', f, 'spi', 0.1);
    results.push({ test: 'sensitivity_runs', pass: !sens.error && typeof sens.change === 'number' });
    return results;
  }

  // عرض واجهة بسيط في لوحة المخاطر
  function renderPanel(container, bundle) {
    if (!container || !bundle) return;
    const lang = (typeof currentLang !== 'undefined' ? currentLang : 'ar');
    let html = '<div class="ops-panel" style="margin-top:16px;"><div class="ops-panel-header"><h2>المؤشرات المركبة (0–100)</h2><span style="font-size:0.75rem;color:var(--text-secondary)">طبقة شفافة — ليست تصنيفاً رسمياً</span></div><div class="ops-panel-body">';
    html += '<div class="kpi-grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));">';
    Object.keys(bundle.indices).forEach(k => {
      const ix = bundle.indices[k];
      const name = ix.name[lang] || ix.name.ar;
      html += `<div class="kpi" style="border-inline-start:3px solid ${ix.classification.color}"><div class="kpi-label">${name}</div><div class="kpi-value">${ix.final_0_100}</div><div class="kpi-meta">${ix.classification[lang] || ix.classification.ar} · أساس ${ix.base_score}</div></div>`;
    });
    html += '</div>';
    // تفصيل أول مؤشر
    const first = bundle.indices.drought;
    html += '<details style="margin-top:12px;"><summary style="cursor:pointer;font-weight:600;">شفافية — مساهمات مؤشر الجفاف</summary><table class="data-table" style="width:100%;margin-top:8px;font-size:0.85rem;"><thead><tr><th>العامل</th><th>الوزن</th><th>الدرجة</th><th>المساهمة</th></tr></thead><tbody>';
    first.contributions.forEach(c => {
      const lab = c.label[lang] || c.label.ar;
      html += `<tr><td>${lab}</td><td>${(c.weight * 100).toFixed(1)}%</td><td>${c.score.toFixed(2)}</td><td>${(c.contribution * 100).toFixed(1)}</td></tr>`;
    });
    html += '</tbody></table>';
    html += `<p style="font-size:0.8rem;color:var(--text-secondary);margin-top:8px;">معامل التعديل الإجمالي: ${first.adjustment_multiplier} → نهائي ${first.final_0_100}. ${first.disclaimer[lang] || first.disclaimer.ar}</p>`;
    html += '</details></div></div>';
    container.innerHTML = html;
  }

  global.CompositeEngine = {
    DEFAULT_MATRICES,
    DEFAULT_ADJUSTMENTS,
    classify,
    validateMatrix,
    normalizeWeights,
    standardizeFactor,
    computeIndex,
    computeAll,
    factorsFromAnalysis,
    sensitivity,
    loadModels,
    saveModels,
    getDefaultMatrices,
    getDefaultAdjustments,
    runSelfTests,
    renderPanel
  };
})(typeof window !== 'undefined' ? window : globalThis);
