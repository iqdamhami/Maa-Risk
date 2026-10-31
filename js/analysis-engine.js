/* ========================================
   ماء ريسك — محرك التحليل العلمي والتنبؤ
   يعمل على بيانات المستخدم المرفوعة أو البيانات التجريبية
   مع تمييز صريح بين المصدرين
   ======================================== */

const ANALYSIS_STORE_KEY = 'maarisk_analysis_results';
const ANALYSIS_DATA_KEY = 'maarisk_analysis_dataset';

const AnalysisEngine = (() => {
  function mean(arr) {
    const a = arr.filter(x => x != null && !isNaN(x));
    if (!a.length) return null;
    return a.reduce((s, x) => s + x, 0) / a.length;
  }
  function std(arr) {
    const a = arr.filter(x => x != null && !isNaN(x));
    if (a.length < 2) return null;
    const m = mean(a);
    return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
  }
  function pearson(xs, ys) {
    const pairs = [];
    for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
      if (xs[i] != null && ys[i] != null && !isNaN(xs[i]) && !isNaN(ys[i])) {
        pairs.push([xs[i], ys[i]]);
      }
    }
    if (pairs.length < 3) return null;
    const mx = mean(pairs.map(p => p[0]));
    const my = mean(pairs.map(p => p[1]));
    let num = 0, dx = 0, dy = 0;
    pairs.forEach(([x, y]) => {
      num += (x - mx) * (y - my);
      dx += (x - mx) ** 2;
      dy += (y - my) ** 2;
    });
    if (dx === 0 || dy === 0) return null;
    return num / Math.sqrt(dx * dy);
  }
  function linearRegression(ys) {
    const n = ys.length;
    const xs = ys.map((_, i) => i);
    const valid = [];
    for (let i = 0; i < n; i++) if (ys[i] != null && !isNaN(ys[i])) valid.push([xs[i], ys[i]]);
    if (valid.length < 3) return null;
    const mx = mean(valid.map(p => p[0]));
    const my = mean(valid.map(p => p[1]));
    let num = 0, den = 0;
    valid.forEach(([x, y]) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
    if (den === 0) return null;
    const slope = num / den;
    const intercept = my - slope * mx;
    // residual std
    const residuals = valid.map(([x, y]) => y - (slope * x + intercept));
    const se = std(residuals) || 0;
    return { slope, intercept, se, n: valid.length };
  }

  /**
   * SPI بمنهج أقرب للرسمي: ملاءمة توزيعة غاما (طريقة العزوم) ثم تحويل عبر Φ⁻¹
   * مرجع مفاهيمي: McKee et al. (1993) — SPI
   * قيود: معايرة على العيّنة نفسها؛ السلاسل القصيرة تزيد عدم اليقين؛ الصفر يُعالج باحتمال كتلة عند 0.
   */
  function logGamma(z) {
    // Stirling approximation
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.984369654078861e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    z -= 1;
    let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  function lowerIncompleteGamma(s, x) {
    // series for x < s+1, continued fraction otherwise — simplified series+CF hybrid
    if (x <= 0) return 0;
    if (x < s + 1) {
      let sum = 1 / s, term = 1 / s;
      for (let n = 1; n < 200; n++) {
        term *= x / (s + n);
        sum += term;
        if (Math.abs(term) < 1e-12 * Math.abs(sum)) break;
      }
      return sum * Math.exp(-x + s * Math.log(x) - logGamma(s));
    }
    // continued fraction (Lentz)
    let b = x + 1 - s, c = 1 / 1e-30, d = 1 / b, h = d;
    for (let i = 1; i < 200; i++) {
      const an = -i * (i - s);
      b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-30) d = 1e-30;
      c = b + an / c; if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-10) break;
    }
    const cf = Math.exp(-x + s * Math.log(x) - logGamma(s)) * h;
    return 1 - cf;
  }
  function gammaCDF(x, shape, scale) {
    if (x <= 0) return 0;
    return lowerIncompleteGamma(shape, x / scale);
  }
  /** Inverse standard normal (Acklam approximation) */
  function invNorm(p) {
    if (p <= 0) return -8;
    if (p >= 1) return 8;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
      1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
      6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
      -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
      3.754408661907416e+00];
    const plow = 0.02425, phigh = 1 - plow;
    let q, r;
    if (p < plow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
             ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    }
    if (p > phigh) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
              ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    }
    q = p - 0.5; r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5]) * q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }
  function fitGammaMoments(values) {
    const pos = values.filter(v => v != null && !isNaN(v) && v > 0);
    if (pos.length < 8) return null;
    const m = mean(pos);
    const s = std(pos);
    if (!m || !s || s <= 0) return null;
    // method of moments: shape = (μ/σ)^2, scale = σ^2/μ
    let shape = (m / s) ** 2;
    let scale = (s * s) / m;
    if (shape < 0.05) shape = 0.05;
    if (scale <= 0) return null;
    return { shape, scale, n: pos.length, zeroProb: values.filter(v => v === 0).length / values.filter(v => v != null && !isNaN(v)).length };
  }
  function computeSPI(series) {
    const clean = series.map(v => (v == null || isNaN(v) ? null : Number(v)));
    const fitted = fitGammaMoments(clean);
    // إن لم تكفِ العيّنة لغاما، نرجع Z-score مع وسم داخلي عبر خاصية على الدالة
    if (!fitted) {
      const m = mean(clean.filter(v => v != null));
      const s = std(clean.filter(v => v != null));
      computeSPI._method = 'zscore_fallback_short_series';
      if (m == null || !s) return clean.map(() => null);
      return clean.map(v => (v == null ? null : (v - m) / s));
    }
    computeSPI._method = 'gamma_cdf_invnorm';
    const { shape, scale, zeroProb } = fitted;
    return clean.map(v => {
      if (v == null) return null;
      let p;
      if (v <= 0) {
        // احتمال تراكمي عند الصفر ≈ نسبة الأصفار (مقاربة شائعة للسلاسل الجافة)
        p = Math.min(0.99, Math.max(0.01, zeroProb || 0.01)) / 2;
      } else {
        p = gammaCDF(v, shape, scale);
        // خلط مع احتمال الصفر
        p = (zeroProb || 0) + (1 - (zeroProb || 0)) * p;
      }
      p = Math.min(0.9999, Math.max(0.0001, p));
      return invNorm(p);
    });
  }

  function droughtClass(spi) {
    // McKee et al. SPI categories (no gaps/overlaps)
    if (spi == null || !isFinite(spi)) return 'unknown';
    if (spi >= 2.0) return 'extremely_wet';
    if (spi >= 1.5) return 'very_wet';
    if (spi >= 1.0) return 'moderately_wet';
    if (spi > -1.0) return 'near_normal';
    if (spi > -1.5) return 'moderate_drought';
    if (spi > -2.0) return 'severe_drought';
    return 'extreme_drought';
  }

  /**
   * فحص جودة البيانات
   */
  function qualityReport(rows, columns) {
    const issues = [];
    const stats = {};
    columns.forEach(col => {
      const vals = rows.map(r => r[col]);
      const missing = vals.filter(v => v === '' || v == null || v === undefined).length;
      const nums = vals.map(v => (v === '' || v == null) ? NaN : Number(v)).filter(v => !isNaN(v));
      let outliers = 0;
      if (nums.length >= 4) {
        const m = mean(nums);
        const s = std(nums) || 0;
        outliers = nums.filter(v => Math.abs(v - m) > 3 * s).length;
      }
      stats[col] = {
        missing,
        missingPct: rows.length ? +(100 * missing / rows.length).toFixed(1) : 0,
        numericCount: nums.length,
        min: nums.length ? Math.min(...nums) : null,
        max: nums.length ? Math.max(...nums) : null,
        mean: nums.length ? +mean(nums).toFixed(3) : null,
        outliers
      };
      if (stats[col].missingPct > 30) issues.push({ level: 'warn', msg: `عمود ${col}: قيم مفقودة ${stats[col].missingPct}%` });
      if (outliers > 0) issues.push({ level: 'info', msg: `عمود ${col}: ${outliers} قيمة متطرفة محتملة (|z|>3)` });
    });
    if (!rows.length) issues.push({ level: 'error', msg: 'لا توجد صفوف بيانات' });
    return { stats, issues, rowCount: rows.length, columns };
  }

  /**
   * تحليل متكامل من صفوف موحّدة
   * كل صف: { region, date, rainfall, temp, demand, supply, health_index, population }
   */
  function runFullAnalysis(dataset, options = {}) {
    const source = dataset.source || 'unknown'; // 'user' | 'demo'
    const rows = dataset.rows || [];
    const meta = {
      runAt: new Date().toISOString(),
      source,
      isDemo: source !== 'user',
      disclaimer: source === 'user'
        ? 'نتائج مبنية على بيانات مرفوعة من المستخدم. الجودة تعتمد على اكتمال المدخلات.'
        : 'نتائج مبنية على بيانات تجريبية للتوضيح فقط — ليست بيانات ميدانية فعلية.',
      assumptions: [
        'SPI: ملاءمة توزيعة غاما (عزوم) على العينة ثم تحويل بالدالة العكسية للتوزيع الطبيعي المعياري؛ معايرة على نفس السلسلة — ليس بديلاً عن معايرة مناخية طويلة externally.',
        'العجز المائي = الطلب − العرض عند توفر العمودين.',
        'التنبؤ خطّي على السلسلة الزمنية مع نطاق ±1.96·SE (تقريبي).',
        'معامل بيرسون يقيس ارتباطاً خطياً ولا يعني سببية.'
      ],
      equations: {
        spi: 'P~Gamma(α,β) → F(P) → SPI = Φ⁻¹(F(P)) ; fallback Z-score إن n صغير',
        deficit: 'Deficit = Demand − Supply',
        stress: 'WaterStress = Demand / max(Supply, ε)',
        forecast: 'ŷ_{t+h} = a + b·(t+h) ; CI ≈ ŷ ± 1.96·SE'
      },
      options
    };

    const rainfall = rows.map(r => num(r.rainfall));
    const demand = rows.map(r => num(r.demand));
    const supply = rows.map(r => num(r.supply));
    const health = rows.map(r => num(r.health_index));
    const temp = rows.map(r => num(r.temp));
    const population = rows.map(r => num(r.population));

    const quality = qualityReport(rows, Object.keys(rows[0] || {}));

    // جفاف
    const spi = computeSPI(rainfall);
    const droughtCounts = {};
    spi.forEach(v => {
      const c = droughtClass(v);
      droughtCounts[c] = (droughtCounts[c] || 0) + 1;
    });
    const latestSpi = [...spi].reverse().find(v => v != null) ?? null;

    // عجز مائي
    const deficits = rows.map((r, i) => {
      const d = demand[i];
      const s = supply[i];
      if (d == null || s == null) return null;
      return d - s;
    });
    const stress = rows.map((r, i) => {
      const d = demand[i];
      const s = supply[i];
      if (d == null || s == null) return null;
      return d / Math.max(s, 0.001);
    });

    // ارتباط مناخ–صحة
    const corrRainHealth = pearson(rainfall, health);
    const corrTempHealth = pearson(temp, health);
    const corrSpiHealth = pearson(spi, health);

    // هشاشة مجتمعية تقريبية
    const vulnerability = rows.map((r, i) => {
      const parts = [];
      if (spi[i] != null) parts.push(Math.min(1, Math.max(0, (-spi[i] + 1) / 3)));
      if (stress[i] != null) parts.push(Math.min(1, stress[i] / 2));
      if (health[i] != null) parts.push(Math.min(1, health[i] / 100));
      if (!parts.length) return null;
      return parts.reduce((a, b) => a + b, 0) / parts.length;
    });
    const avgVuln = mean(vulnerability.filter(v => v != null));

    // تنبؤ أمطار
    const horizon = options.horizon || 6;
    const reg = linearRegression(rainfall);
    const forecast = [];
    if (reg) {
      for (let h = 1; h <= horizon; h++) {
        const t = rainfall.length - 1 + h;
        const yhat = reg.intercept + reg.slope * t;
        const lo = yhat - 1.96 * (reg.se || 0);
        const hi = yhat + 1.96 * (reg.se || 0);
        forecast.push({
          step: h,
          rainfall_mean: round(yhat, 2),
          rainfall_lo: round(lo, 2),
          rainfall_hi: round(hi, 2),
          method: 'linear_trend',
          note: reg.n < 12 ? 'سلسلة قصيرة — عدم اليقين مرتفع' : 'اتجاه خطّي على العينة المتاحة'
        });
      }
    }

    // سيناريوهات بسيطة
    const baseDemand = mean(demand.filter(v => v != null));
    const baseSupply = mean(supply.filter(v => v != null));
    const scenarios = [
      {
        id: 'baseline',
        name: 'مرجع (استمرار الاتجاه)',
        demandFactor: 1,
        supplyFactor: 1,
        climate: 'SSP2-like (تبسيط)'
      },
      {
        id: 'dry',
        name: 'جفاف أشد (−20% عرض مائي)',
        demandFactor: 1.05,
        supplyFactor: 0.8,
        climate: 'سيناريو جاف اختباري'
      },
      {
        id: 'growth',
        name: 'نمو طلب (+15%)',
        demandFactor: 1.15,
        supplyFactor: 0.95,
        climate: 'ضغط سكاني/تنموي'
      }
    ].map(sc => {
      const d = baseDemand != null ? baseDemand * sc.demandFactor : null;
      const s = baseSupply != null ? baseSupply * sc.supplyFactor : null;
      return {
        ...sc,
        projectedDemand: d != null ? round(d, 1) : null,
        projectedSupply: s != null ? round(s, 1) : null,
        projectedDeficit: d != null && s != null ? round(d - s, 1) : null,
        reliable: baseDemand != null && baseSupply != null
      };
    });

    const result = {
      meta,
      quality,
      drought: {
        spiSeries: spi.map(v => (v == null ? null : round(v, 3))),
        rainfallSeries: rainfall,
        method: computeSPI._method || 'gamma_cdf_invnorm',
        latestSpi: latestSpi != null ? round(latestSpi, 3) : null,
        classCounts: droughtCounts,
        classification: droughtClass(latestSpi)
      },
      water: {
        meanDemand: baseDemand != null ? round(baseDemand, 2) : null,
        meanSupply: baseSupply != null ? round(baseSupply, 2) : null,
        meanDeficit: mean(deficits.filter(v => v != null)),
        meanStress: mean(stress.filter(v => v != null)),
        deficitSeries: deficits.map(v => (v == null ? null : round(v, 2)))
      },
      climateHealth: {
        pearson_rainfall_health: corrRainHealth != null ? round(corrRainHealth, 3) : null,
        pearson_temp_health: corrTempHealth != null ? round(corrTempHealth, 3) : null,
        pearson_spi_health: corrSpiHealth != null ? round(corrSpiHealth, 3) : null
      },
      vulnerability: {
        mean: avgVuln != null ? round(avgVuln, 3) : null,
        series: vulnerability.map(v => (v == null ? null : round(v, 3)))
      },
      forecast: {
        horizon,
        rainfall: forecast,
        limitations: [
          'نموذج اتجاه خطّي بسيط — لا يستبدل نماذج مناخية إقليمية.',
          'فترات الثقة تقريبية وتعتمد على تباين الباقي في العينة.',
          reg && reg.n < 24 ? 'عدد المشاهدات محدود؛ يُفضّل سلسلة أطول قبل اتخاذ قرار.' : null
        ].filter(Boolean)
      },
      scenarios,
      scores: {
        waterScarcity: scoreFromStress(mean(stress.filter(v => v != null))),
        drought: scoreFromSpi(latestSpi),
        healthVulnerability: avgVuln != null ? round(avgVuln, 3) : null,
        composite: null
      }
    };
    const parts = [result.scores.waterScarcity, result.scores.drought, result.scores.healthVulnerability].filter(v => v != null);
    result.scores.composite = parts.length ? round(parts.reduce((a, b) => a + b, 0) / parts.length, 3) : null;

    localStorage.setItem(ANALYSIS_STORE_KEY, JSON.stringify(result));
    try {
      if (typeof DataStore !== 'undefined' && typeof currentActor === 'function') {
        const a = currentActor();
        if (a) DataStore.saveUserAnalysis(a.id, result);
      }
    } catch (e) { console.warn('saveUserAnalysis', e.message); }
    return result;
  }

  function scoreFromSpi(spi) {
    if (spi == null) return null;
    // أعلى = أسوأ
    return round(Math.min(1, Math.max(0, (-spi + 0.5) / 2.5)), 3);
  }
  function scoreFromStress(st) {
    if (st == null) return null;
    return round(Math.min(1, Math.max(0, (st - 0.5) / 1.5)), 3);
  }
  function num(v) {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  }
  function round(x, d) {
    if (x == null || isNaN(x)) return null;
    const m = 10 ** d;
    return Math.round(x * m) / m;
  }

  /** تحويل صفوف CSV العامة إلى مخطط التحليل */
  function normalizeRows(rawRows) {
    if (!rawRows || !rawRows.length) return [];
    const keyMap = {
      rainfall: ['rainfall_mm', 'rainfall', 'precip', 'precipitation', 'rain'],
      temp: ['avg_temp_c', 'temp', 'temperature', 'tavg'],
      demand: ['demand', 'water_demand', 'demand_m3'],
      supply: ['supply', 'surface_water_m3', 'water_supply', 'supply_m3'],
      health_index: ['diarrhea_cases_per_1000', 'health_index', 'health', 'malnutrition_rate_pct'],
      population: ['population', 'pop'],
      region: ['region_name', 'region', 'region_id'],
      date: ['date', 'year', 'month']
    };
    function pick(row, names) {
      const keys = Object.keys(row);
      for (const n of names) {
        const k = keys.find(x => x.toLowerCase() === n.toLowerCase());
        if (k != null && row[k] !== '') return row[k];
      }
      return null;
    }
    return rawRows.map(row => {
      const o = {};
      Object.keys(keyMap).forEach(std => { o[std] = pick(row, keyMap[std]); });
      // دمج year-month إن وُجد
      if (row.year && row.month) o.date = `${row.year}-${String(row.month).padStart(2, '0')}`;
      return o;
    });
  }

  function parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
    if (lines.length < 2) return [];
    const headers = splitCSVLine(lines[0]);
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const cells = splitCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h.trim()] = (cells[i] || '').trim(); });
      return obj;
    });
  }
  function splitCSVLine(line) {
    const out = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { q = !q; continue; }
      if (c === ',' && !q) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    out.push(cur);
    return out;
  }

  function loadStoredAnalysis() {
    try { return JSON.parse(localStorage.getItem(ANALYSIS_STORE_KEY) || 'null'); }
    catch { return null; }
  }

  function saveDataset(dataset) {
    localStorage.setItem(ANALYSIS_DATA_KEY, JSON.stringify(dataset));
    try {
      if (typeof DataStore !== 'undefined' && typeof currentActor === 'function') {
        const a = currentActor();
        if (a) DataStore.saveUserDataset(a.id, dataset);
      }
    } catch (e) { console.warn('DataStore saveUserDataset', e.message); }
  }
  function loadDataset() {
    try {
      if (typeof DataStore !== 'undefined' && typeof currentActor === 'function') {
        const a = currentActor();
        if (a) {
          const ds = DataStore.loadUserDataset(a.id);
          if (ds) return ds;
        }
      }
    } catch (e) { /* fallthrough */ }
    try { return JSON.parse(localStorage.getItem(ANALYSIS_DATA_KEY) || 'null'); }
    catch { return null; }
  }

  /** بيانات تجريبية داخلية (موسومة demo) */
  function getDemoDataset() {
    const rows = [];
    for (let y = 2018; y <= 2023; y++) {
      for (let m = 1; m <= 12; m++) {
        const season = Math.sin((m - 1) / 12 * Math.PI * 2);
        const rainfall = Math.max(0, 15 + 12 * season + ((y * 12 + m) % 7) - 3 - (y - 2018) * 0.4);
        const supply = 90000 + rainfall * 1200;
        const demand = 100000 + (y - 2018) * 2500 + (m > 5 && m < 10 ? 8000 : 0);
        rows.push({
          region: 'حوض تجريبي',
          date: `${y}-${String(m).padStart(2, '0')}`,
          rainfall: +rainfall.toFixed(1),
          temp: +(18 + 10 * Math.sin((m - 3) / 12 * Math.PI * 2) + (y - 2018) * 0.05).toFixed(1),
          demand: Math.round(demand),
          supply: Math.round(supply),
          health_index: +(12 + Math.max(0, -((rainfall - 15) / 5)) * 3 + (demand > supply ? 4 : 0)).toFixed(1),
          population: 12000 + (y - 2018) * 200
        });
      }
    }
    return { source: 'demo', rows, label: 'سلسلة شهرية تجريبية 2018–2023' };
  }


  /**
   * قراءة فعلية للملفات عبر FileReader
   * يدعم: CSV, TXT, JSON/GeoJSON, محاولة XLSX عبر SheetJS إن وُجدت في الصفحة
   */
  function importFilesAsync(fileList) {
    const files = Array.from(fileList || []);
    return Promise.all(files.map(file => readOneFile(file))).then(results => {
      const mergedRows = [];
      const reports = [];
      results.forEach(r => {
        reports.push(r.report);
        if (r.rows && r.rows.length) mergedRows.push(...r.rows);
      });
      return { rows: mergedRows, reports, files: results };
    });
  }

  function readOneFile(file) {
    const name = file.name || 'file';
    const lower = name.toLowerCase();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => resolve({
        name, rows: [], report: { ok: false, format: 'unknown', message: 'تعذر قراءة الملف: ' + name }
      });

      if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        reader.onload = () => {
          try {
            const raw = parseCSV(String(reader.result || ''));
            const rows = normalizeRows(raw);
            resolve({
              name, rows, rawCount: raw.length,
              report: { ok: true, format: 'csv', message: `CSV: ${rows.length} صف مُطبّع من ${name}` }
            });
          } catch (e) {
            resolve({ name, rows: [], report: { ok: false, format: 'csv', message: e.message } });
          }
        };
        reader.readAsText(file, 'UTF-8');
        return;
      }

      if (lower.endsWith('.geojson') || lower.endsWith('.json')) {
        reader.onload = () => {
          try {
            const gj = JSON.parse(String(reader.result || '{}'));
            let features = [];
            if (gj.type === 'FeatureCollection') features = gj.features || [];
            else if (gj.type === 'Feature') features = [gj];
            else if (Array.isArray(gj)) features = gj;
            const raw = features.map(f => ({ ...(f.properties || {}), _geometry: f.geometry ? f.geometry.type : null }));
            const rows = normalizeRows(raw);
            resolve({
              name, rows, geojson: gj,
              report: { ok: true, format: 'geojson', message: `GeoJSON: ${features.length} معلم / ${rows.length} صف خصائص` }
            });
          } catch (e) {
            resolve({ name, rows: [], report: { ok: false, format: 'geojson', message: e.message } });
          }
        };
        reader.readAsText(file, 'UTF-8');
        return;
      }

      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        reader.onload = () => {
          try {
            if (typeof XLSX === 'undefined') {
              resolve({
                name, rows: [],
                report: {
                  ok: false, format: 'excel',
                  message: 'Excel يتطلب مكتبة SheetJS. أُضيفت للصفحة — أعد المحاولة أو حوّل إلى CSV.'
                }
              });
              return;
            }
            const data = new Uint8Array(reader.result);
            const wb = XLSX.read(data, { type: 'array' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            const rows = normalizeRows(raw);
            resolve({
              name, rows,
              report: { ok: true, format: 'excel', message: `Excel: ${rows.length} صف من الورقة الأولى` }
            });
          } catch (e) {
            resolve({ name, rows: [], report: { ok: false, format: 'excel', message: e.message } });
          }
        };
        reader.readAsArrayBuffer(file);
        return;
      }

      if (lower.endsWith('.shp') || lower.endsWith('.dbf') || lower.endsWith('.shx')) {
        resolve({
          name, rows: [],
          report: {
            ok: false, format: 'shapefile',
            message: 'Shapefile متعدد الملفات (.shp+.dbf+.shx). حالياً يُدعم عبر تحويل إلى GeoJSON/CSV، أو رفع ملف GeoJSON.'
          }
        });
        return;
      }

      if (lower.endsWith('.nc') || lower.endsWith('.netcdf')) {
        resolve({
          name, rows: [],
          report: {
            ok: false, format: 'netcdf',
            message: 'NetCDF يحتاج معالجة خادمية أو مكتبة متخصصة. صدّر المتغيرات إلى CSV شهري ثم ارفعها.'
          }
        });
        return;
      }

      // محاولة نصية عامة
      reader.onload = () => {
        try {
          const text = String(reader.result || '');
          if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
            const raw = JSON.parse(text);
            const rows = normalizeRows(Array.isArray(raw) ? raw : [raw]);
            resolve({ name, rows, report: { ok: true, format: 'json', message: 'JSON عام' } });
            return;
          }
          const raw = parseCSV(text);
          const rows = normalizeRows(raw);
          resolve({ name, rows, report: { ok: rows.length > 0, format: 'text', message: `قراءة نصية: ${rows.length} صف` } });
        } catch (e) {
          resolve({ name, rows: [], report: { ok: false, format: 'unknown', message: 'صيغة غير مدعومة: ' + name } });
        }
      };
      reader.readAsText(file, 'UTF-8');
    });
  }

  return {
    qualityReport,
    runFullAnalysis,
    normalizeRows,
    parseCSV,
    loadStoredAnalysis,
    saveDataset,
    loadDataset,
    getDemoDataset,
    computeSPI,
    droughtClass,
    importFilesAsync,
    readOneFile
  };
})();

// ربط واجهة صفحة المخاطر إن وُجدت
document.addEventListener('DOMContentLoaded', () => {
  if (typeof document.body.dataset.page !== 'undefined' && document.body.dataset.page !== 'risk') {
    // أيضاً نربط من data page عند توفر زر
  }

  const runBtn = document.getElementById('btn-run-analysis');
  const resultsBox = document.getElementById('analysis-results-panel');
  // الزائر: لا نربط زر التشغيل (guard يمنعه أصلاً) لكن لا نكسر تحميل المحرك إن وُجدت عناصر
  if (typeof isGuest === 'function' && isGuest() && !runBtn) {
    return;
  }

  function renderAnalysis(result) {
    if (!resultsBox || !result) return;
    const demoBadge = result.meta.isDemo
      ? '<span class="badge badge-warning">بيانات تجريبية — ليست فعلية</span>'
      : '<span class="badge badge-success">بيانات مستخدم</span>';
    const d = result.drought;
    const w = result.water;
    const ch = result.climateHealth;
    const f = result.forecast;
    resultsBox.innerHTML = `
      <div class="card" style="margin-top:20px;">
        <div class="card-header">
          <span class="card-title">نتائج المحرك العلمي</span>
          ${demoBadge}
        </div>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px;">${escape(result.meta.disclaimer)}</p>
        <div class="grid-3" style="margin-bottom:16px;">
          <div class="stat-card"><div class="label">SPI الأخير</div><div class="value">${val(d.latestSpi)}</div><div class="label">${d.classification} · ${escape(d.method || '')}</div></div>
          <div class="stat-card"><div class="label">متوسط العجز المائي</div><div class="value">${val(w.meanDeficit)}</div></div>
          <div class="stat-card"><div class="label">المؤشر المركّب</div><div class="value">${val(result.scores.composite)}</div></div>
        </div>
        <h4 style="margin:12px 0 8px;">ارتباط مناخ–صحة (بيرسون)</h4>
        <p style="font-size:0.9rem;">أمطار–صحة: <strong>${val(ch.pearson_rainfall_health)}</strong> ·
           حرارة–صحة: <strong>${val(ch.pearson_temp_health)}</strong> ·
           SPI–صحة: <strong>${val(ch.pearson_spi_health)}</strong></p>
        <h4 style="margin:12px 0 8px;">تنبؤ الأمطار (أفق ${f.horizon} خطوات)</h4>
        <div class="table-wrap"><table>
          <thead><tr><th>الخطوة</th><th>المتوسط</th><th>حد أدنى</th><th>حد أعلى</th><th>ملاحظة</th></tr></thead>
          <tbody>
            ${(f.rainfall || []).map(r => `<tr>
              <td>${r.step}</td><td>${val(r.rainfall_mean)}</td><td>${val(r.rainfall_lo)}</td><td>${val(r.rainfall_hi)}</td>
              <td style="font-size:0.8rem;">${escape(r.note || '')}</td></tr>`).join('') || '<tr><td colspan="5">لا يكفي من النقاط للتنبؤ</td></tr>'}
          </tbody>
        </table></div>
        <h4 style="margin:12px 0 8px;">سيناريوهات</h4>
        <div class="table-wrap"><table>
          <thead><tr><th>السيناريو</th><th>طلب</th><th>عرض</th><th>عجز</th><th>موثوق؟</th></tr></thead>
          <tbody>
            ${(result.scenarios || []).map(s => `<tr>
              <td>${escape(s.name)}</td><td>${val(s.projectedDemand)}</td><td>${val(s.projectedSupply)}</td>
              <td>${val(s.projectedDeficit)}</td><td>${s.reliable ? 'نعم' : 'لا — نقص بيانات'}</td></tr>`).join('')}
          </tbody>
        </table></div>
        <h4 style="margin:12px 0 8px;">جودة البيانات</h4>
        <ul style="font-size:0.85rem;color:var(--text-secondary);">
          ${(result.quality.issues || []).map(i => `<li>[${i.level}] ${escape(i.msg)}</li>`).join('') || '<li>لا ملاحظات حرجة</li>'}
        </ul>
        <h4 style="margin:12px 0 8px;">افتراضات ومعادلات</h4>
        <ul style="font-size:0.8rem;color:var(--text-secondary);">
          ${(result.meta.assumptions || []).map(a => `<li>${escape(a)}</li>`).join('')}
        </ul>
        <p style="font-size:0.75rem;color:var(--text-secondary);">SPI: ${result.meta.equations.spi} · العجز: ${result.meta.equations.deficit}</p>
      </div>`;

    function val(x) { return x == null || x === '' ? '—' : x; }
    function escape(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
  }

  // زر تشغيل التحليل
  if (runBtn) {
    runBtn.addEventListener('click', () => {
      runBtn.disabled = true;
      const original = runBtn.innerHTML;
      runBtn.innerHTML = '<span class="spinner"></span> جاري التحليل العلمي...';
      setTimeout(() => {
        try {
          let ds = AnalysisEngine.loadDataset();
          if (!ds || !ds.rows || !ds.rows.length) {
            ds = AnalysisEngine.getDemoDataset();
            AnalysisEngine.saveDataset(ds);
          }
          const result = AnalysisEngine.runFullAnalysis(ds, { horizon: 6 });
          // مزامنة مع حالة المشروع القديمة
          if (typeof setState === 'function') {
            setState({
              analysisDone: true,
              analysisScores: result.scores,
              analysisMeta: { source: result.meta.source, isDemo: result.meta.isDemo }
            });
          }
          window.__lastAnalysisResult = result;
          renderAnalysis(result);
          if (typeof SpiGauge !== 'undefined') {
            try {
              result._rainfallSeries = (result.drought && result.drought.rainfallSeries) || null;
              SpiGauge.bindControls();
              SpiGauge.updateFromAnalysis(result);
            } catch (ge) { console.warn('SpiGauge', ge); }
          } else {
            console.warn('SpiGauge missing — تحقق من تحميل js/spi-gauge.js');
          }
          // تحديث بطاقات الملخص
          try {
            const cards = document.querySelectorAll('#risk-summary-cards .stat-card');
            if (cards.length >= 4 && result.scores) {
              const fmt = (x) => (x == null ? '—' : (typeof x === 'number' ? x.toFixed(2) : x));
              if (cards[0]) { cards[0].querySelector('.value').textContent = fmt(result.scores.waterScarcity); cards[0].querySelectorAll('div')[2].textContent = 'من التحليل'; }
              if (cards[1]) { cards[1].querySelector('.value').textContent = fmt(result.drought && result.drought.latestSpi); cards[1].querySelectorAll('div')[2].textContent = (result.drought && result.drought.classification) || ''; }
              if (cards[2]) { cards[2].querySelector('.value').textContent = fmt(result.scores.healthVulnerability); cards[2].querySelectorAll('div')[2].textContent = 'من التحليل'; }
              if (cards[3]) { cards[3].querySelector('.value').textContent = fmt(result.scores.composite); cards[3].querySelectorAll('div')[2].textContent = 'مركّب'; }
            }
          } catch (e) {}
          if (typeof CompositeEngine !== 'undefined') {
            try {
              const zones = (window.__riskZones) || [
                { name: 'عام', water: result.scores.waterStress || 0.5, drought: result.scores.drought || 0.5, health: result.scores.health || 0.5, density: 40, access: 55 }
              ];
              const bundle = CompositeEngine.computeAll(result, zones[0]);
              window.__lastComposite = bundle;
              localStorage.setItem('maarisk_last_composite', JSON.stringify(bundle));
              let host = document.getElementById('composite-results-panel');
              if (!host && resultsBox) {
                host = document.createElement('div');
                host.id = 'composite-results-panel';
                resultsBox.appendChild(host);
              }
              if (host) CompositeEngine.renderPanel(host, bundle);
            } catch (ce) { console.warn('CompositeEngine', ce); }
          }
          if (typeof showToast === 'function') {
            showToast(result.meta.isDemo
              ? 'اكتمل التحليل على بيانات تجريبية (موسومة)'
              : 'اكتمل التحليل على بيانات المستخدم');
          }
        } catch (e) {
          console.error(e);
          if (typeof showToast === 'function') showToast('فشل التحليل: ' + e.message, 'warning');
        } finally {
          runBtn.disabled = false;
          runBtn.innerHTML = original;
        }
      }, 400);
    });
  }

  // عرض آخر نتيجة محفوظة
  if (resultsBox) {
    const prev = AnalysisEngine.loadStoredAnalysis();
    if (prev) {
      window.__lastAnalysisResult = prev;
      renderAnalysis(prev);
      if (typeof SpiGauge !== 'undefined') {
        SpiGauge.bindControls();
        SpiGauge.updateFromAnalysis(prev);
      }
    }
  }

  // استيراد CSV من صفحة البيانات
  async function handlePlatformFiles(fileList) {
    if (!fileList || !fileList.length) return;
    if (typeof showToast === 'function') showToast('جاري قراءة ' + fileList.length + ' ملف...');
    const result = await AnalysisEngine.importFilesAsync(fileList);
    result.reports.forEach(rep => {
      if (typeof showToast === 'function') {
        showToast(rep.message, rep.ok ? undefined : 'warning');
      }
    });
    if (result.rows.length) {
      const ds = {
        source: 'user',
        rows: result.rows,
        label: result.files.map(f => f.name).join(', '),
        importedAt: new Date().toISOString(),
        importReports: result.reports
      };
      AnalysisEngine.saveDataset(ds);
      if (typeof setState === 'function') {
        const tableRows = result.rows.slice(0, 50).map((r, i) => ({
          name: r.region || ('سجل ' + (i + 1)),
          type: 'مرفوع',
          source: 'ملف مستخدم',
          period: r.date || '—',
          quality: 'medium'
        }));
        setState({ dataRows: tableRows, demoLoaded: true });
      }
      // إعادة رسم جدول البيانات إن وُجدت الدالة عبر حدث
      document.dispatchEvent(new CustomEvent('maarisk:data-imported', { detail: ds }));
    }
  }

  // رفع الملفات: DataHub فقط على صفحة البيانات (يمنع الاستيراد المزدوج)
  const fileInput = document.getElementById('file-input');
  if (fileInput && document.body && document.body.dataset.page !== 'data') {
    fileInput.addEventListener('change', () => handlePlatformFiles(fileInput.files));
  }
  if (typeof window.maariskHandleFiles !== 'function') {
    window.maariskHandleFiles = handlePlatformFiles;
  }
});
