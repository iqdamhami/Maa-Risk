/**
 * SPI Radial Gauge — Mā’ Risk
 * يعرض قيمة SPI المحسوبة فعلياً من AnalysisEngine مع تصنيفات McKee القياسية.
 */
(function (global) {
  'use strict';

  /** تصنيفات SPI القياسية (McKee et al.) — حدود بلا تداخل */
  function classifySPI(spi) {
    if (spi == null || !isFinite(spi)) {
      return { key: 'unknown', ar: 'غير متاح', en: 'Unavailable', fr: 'Indisponible', color: '#94A3B8', impact: { ar: 'لا تتوفر قراءة موثوقة.', en: 'No reliable reading.', fr: 'Pas de lecture fiable.' } };
    }
    if (spi >= 2.0) return { key: 'ew', ar: 'رطوبة شديدة جداً', en: 'Extremely wet', fr: 'Extrêmement humide', color: '#1D4ED8', impact: { ar: 'فائض رطوبة قد يرتبط بفيضانات محلية.', en: 'Moisture surplus; possible local flooding.', fr: 'Excès d’humidité; inondations locales possibles.' } };
    if (spi >= 1.5) return { key: 'sw', ar: 'رطوبة شديدة', en: 'Very wet', fr: 'Très humide', color: '#3B82F6', impact: { ar: 'ظروف رطبة أعلى من المعتاد.', en: 'Wet conditions above normal.', fr: 'Conditions plus humides que la normale.' } };
    if (spi >= 1.0) return { key: 'mw', ar: 'رطوبة معتدلة', en: 'Moderately wet', fr: 'Modérément humide', color: '#60A5FA', impact: { ar: 'رطوبة معتدلة.', en: 'Moderately wet.', fr: 'Humidité modérée.' } };
    if (spi > -1.0) return { key: 'nn', ar: 'قريب من الطبيعي', en: 'Near normal', fr: 'Proche de la normale', color: '#22C55E', impact: { ar: 'ضمن النطاق الطبيعي تقريباً.', en: 'Approximately near normal.', fr: 'Proche de la normale.' } };
    if (spi > -1.5) return { key: 'md', ar: 'جفاف معتدل', en: 'Moderate drought', fr: 'Sécheresse modérée', color: '#EAB308', impact: { ar: 'إجهاد مائي أولي على الزراعة والرعي.', en: 'Early water stress on crops and rangelands.', fr: 'Stress hydrique précoce.' } };
    if (spi > -2.0) return { key: 'sd', ar: 'جفاف شديد', en: 'Severe drought', fr: 'Sécheresse sévère', color: '#E07A3D', impact: { ar: 'نقص ملحوظ في الهطول؛ مراقبة الإمدادات.', en: 'Marked rainfall deficit; monitor supplies.', fr: 'Déficit marqué; surveiller les approvisionnements.' } };
    return { key: 'ed', ar: 'جفاف شديد جداً', en: 'Extreme drought', fr: 'Sécheresse extrême', color: '#C23B22', impact: { ar: 'ظروف حرجة؛ أولوية للتدخل والتكيف.', en: 'Critical conditions; prioritize response.', fr: 'Conditions critiques; prioriser la réponse.' } };
  }

  function lang() {
    return (typeof currentLang !== 'undefined' && currentLang) ? currentLang : 'ar';
  }

  function t3(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang()] || obj.ar || obj.en || '';
  }

  /** SVG semi-circular gauge: visual domain [-2, 2], value not clipped for display text */
  function renderGaugeSVG(spi, width) {
    width = width || 280;
    const h = width * 0.62;
    const cx = width / 2;
    const cy = h * 0.92;
    const r = width * 0.38;
    // angles: left (-2) = π, right (+2) = 0  (semicircle upper)
    function angleFor(v) {
      const clamped = Math.max(-2, Math.min(2, v == null ? 0 : v));
      const t = (clamped + 2) / 4; // 0..1
      return Math.PI * (1 - t);
    }
    // color segments on arc
    const stops = [
      { from: -2, to: -1.5, color: '#C23B22' },
      { from: -1.5, to: -1, color: '#E07A3D' },
      { from: -1, to: 1, color: '#22C55E' },
      { from: 1, to: 1.5, color: '#60A5FA' },
      { from: 1.5, to: 2, color: '#1D4ED8' }
    ];
    function polar(a, rad) {
      return [cx + rad * Math.cos(a), cy - rad * Math.sin(a)];
    }
    function arcPath(a0, a1, rad) {
      const [x0, y0] = polar(a0, rad);
      const [x1, y1] = polar(a1, rad);
      const large = Math.abs(a0 - a1) > Math.PI ? 1 : 0;
      return `M ${x0} ${y0} A ${rad} ${rad} 0 ${large} 1 ${x1} ${y1}`;
    }
    let arcs = '';
    stops.forEach(s => {
      const a0 = angleFor(s.from);
      const a1 = angleFor(s.to);
      arcs += `<path d="${arcPath(a0, a1, r)}" fill="none" stroke="${s.color}" stroke-width="${r * 0.22}" stroke-linecap="butt" opacity="0.9"/>`;
    });
    // track background
    const track = `<path d="${arcPath(Math.PI, 0, r)}" fill="none" stroke="var(--border, #D0DAE2)" stroke-width="${r * 0.22}" opacity="0.35"/>`;

    const cls = classifySPI(spi);
    const needleA = angleFor(spi == null ? 0 : spi);
    const [nx, ny] = polar(needleA, r * 0.92);
    const needle = spi == null ? '' : `
      <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="${cls.color}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${nx}" cy="${ny}" r="5" fill="${cls.color}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="${cx}" cy="${cy}" r="6" fill="var(--surface, #fff)" stroke="${cls.color}" stroke-width="2"/>
    `;
    const display = spi == null || !isFinite(spi) ? '—' : (Math.round(spi * 100) / 100).toFixed(2);
    const over = spi != null && Math.abs(spi) > 2 ? `<text x="${cx}" y="${cy - r * 0.55}" text-anchor="middle" font-size="10" fill="var(--text-secondary)">خارج ±2 بصرياً · القيمة الفعلية ${display}</text>` : '';

    return `<svg viewBox="0 0 ${width} ${h}" width="100%" height="auto" role="img" aria-label="SPI ${display}">
      ${track}${arcs}${needle}${over}
      <text x="${cx}" y="${cy - r * 0.28}" text-anchor="middle" font-size="${width * 0.12}" font-weight="700" fill="var(--text, #0F1C24)" font-family="inherit">${display}</text>
      <text x="${cx}" y="${cy - r * 0.12}" text-anchor="middle" font-size="${width * 0.045}" fill="${cls.color}" font-weight="600" font-family="inherit">${t3(cls)}</text>
    </svg>`;
  }

  function buildMeta(spi, ctx) {
    const cls = classifySPI(spi);
    const prev = ctx.prevSpi;
    let trend = { ar: '—', en: '—', fr: '—' };
    if (spi != null && prev != null && isFinite(prev)) {
      const d = spi - prev;
      if (d > 0.15) trend = { ar: 'تحسن (أقل جفافاً)', en: 'Improving (less dry)', fr: 'Amélioration' };
      else if (d < -0.15) trend = { ar: 'تفاقم (أكثر جفافاً)', en: 'Worsening (drier)', fr: 'Aggravation' };
      else trend = { ar: 'مستقر تقريباً', en: 'Nearly stable', fr: 'Quasi stable' };
    }
    return { cls, trend };
  }

  /**
   * @param {HTMLElement} root
   * @param {object} state { spi, prevSpi, scale, region, date, source, reliability, kind }
   */
  function mount(root, state) {
    if (!root) return;
    state = state || {};
    const spi = state.spi;
    const meta = buildMeta(spi, state);
    const kindLabel = {
      historical: { ar: 'تاريخي', en: 'Historical', fr: 'Historique' },
      current: { ar: 'حالي', en: 'Current', fr: 'Actuel' },
      forecast: { ar: 'تنبؤي', en: 'Forecast', fr: 'Prévisionnel' }
    };
    const kind = state.kind || 'current';

    root.innerHTML = `
      <div class="spi-gauge-wrap" style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;">
        <div style="flex:1;min-width:240px;max-width:320px;">
          ${renderGaugeSVG(spi, 300)}
        </div>
        <div style="flex:1;min-width:200px;font-size:0.88rem;">
          <div class="kpi" style="margin-bottom:8px;"><div class="kpi-label">SPI</div><div class="kpi-value" style="color:${meta.cls.color}">${spi == null ? '—' : Number(spi).toFixed(2)}</div></div>
          <p style="margin:6px 0;"><strong>${t3(meta.cls)}</strong></p>
          <p style="color:var(--text-secondary);margin:4px 0;">${t3(meta.cls.impact)}</p>
          <ul style="margin:10px 0;padding-inline-start:18px;color:var(--text-secondary);line-height:1.7;">
            <li>المقياس: <strong>SPI-${state.scale || 1}</strong></li>
            <li>المنطقة: <strong>${state.region || '—'}</strong></li>
            <li>تاريخ القراءة: <strong>${state.date || '—'}</strong></li>
            <li>نوع القيمة: <strong>${t3(kindLabel[kind])}</strong></li>
            <li>اتجاه التغير: <strong>${t3(meta.trend)}</strong></li>
            <li>المصدر: <strong>${state.source || '—'}</strong></li>
            <li>الموثوقية: <strong>${state.reliability || '—'}</strong></li>
          </ul>
        </div>
      </div>
    `;
    root.title = spi == null ? 'SPI unavailable' : `SPI=${Number(spi).toFixed(2)} · ${t3(meta.cls)}`;
  }

  /**
   * حساب SPI لمقياس زمني من سلسلة أمطار شهرية عبر AnalysisEngine.computeSPI
   * scale: 1|3|6|12 — مجموع متحرك ثم SPI على السلسلة المجمّعة
   */
  function spiForScale(rainfallSeries, scale) {
    // AnalysisEngine is declared with top-level `const` in analysis-engine.js.
    // Such a binding is visible to other classic scripts but is NOT a property
    // of window/global. Resolve the lexical binding first, then fall back to
    // a global property for older builds.
    const engine = (typeof AnalysisEngine !== 'undefined')
      ? AnalysisEngine
      : global.AnalysisEngine;
    if (!engine || typeof engine.computeSPI !== 'function') {
      return { series: [], latest: null, prev: null, method: null, error: 'engine_missing' };
    }
    scale = Number(scale) || 1;
    const raw = (rainfallSeries || []).map(v => (v == null || isNaN(v) ? null : Number(v)));
    let input = raw;
    if (scale > 1) {
      input = raw.map((_, i) => {
        if (i < scale - 1) return null;
        let s = 0, c = 0;
        for (let k = 0; k < scale; k++) {
          const v = raw[i - k];
          if (v == null) return null;
          s += v; c++;
        }
        return c === scale ? s : null;
      });
    }
    const valid = input.filter(v => v != null).length;
    if (valid < 6) {
      return { series: [], latest: null, prev: null, method: null, error: 'insufficient_data', valid };
    }
    const series = engine.computeSPI(input);
    const nums = series.map((v, i) => ({ v, i })).filter(o => o.v != null);
    const latest = nums.length ? nums[nums.length - 1].v : null;
    const prev = nums.length > 1 ? nums[nums.length - 2].v : null;
    return {
      series,
      latest,
      prev,
      method: engine.computeSPI._method || 'gamma_cdf_invnorm',
      error: null,
      valid
    };
  }


  function updateFromAnalysis(result, controls) {
    const root = document.getElementById('spi-gauge-root');
    if (!root) {
      console.warn('spi-gauge-root not found');
      return;
    }
    controls = controls || {};
    const scaleSel = document.getElementById('spi-scale-select');
    const regionSel = document.getElementById('spi-region-select');
    const scale = Number(controls.scale != null ? controls.scale : (scaleSel && scaleSel.value) || 1) || 1;
    const region = controls.region || (regionSel && regionSel.value) || 'all';

    function fail(msg) {
      mount(root, {
        spi: null,
        scale: scale,
        region: region === 'all' ? 'كامل السلسلة' : region,
        date: '—',
        source: '—',
        reliability: msg || 'لا تتوفر قراءة موثوقة',
        kind: 'current'
      });
    }

    if (!result || !result.drought) {
      fail('شغّل التحليل أولاً لحساب SPI من البيانات');
      return;
    }

    // استخرج سلسلة الأمطار
    let rainfall = null;
    if (result.drought.rainfallSeries && result.drought.rainfallSeries.length) {
      rainfall = result.drought.rainfallSeries;
    } else if (result._rainfallSeries && result._rainfallSeries.length) {
      rainfall = result._rainfallSeries;
    } else if (typeof AnalysisEngine !== 'undefined' && AnalysisEngine.loadDataset) {
      const ds = AnalysisEngine.loadDataset();
      if (ds && ds.rows && ds.rows.length) {
        let rows = ds.rows;
        if (region && region !== 'all') {
          rows = rows.filter(function (r) {
            return String(r.region || r.name || '') === region;
          });
        }
        rainfall = rows.map(function (r) {
          var v = r.rainfall != null ? r.rainfall : (r.precip != null ? r.precip : r.rain);
          return v == null || v === '' ? null : Number(v);
        });
      }
    }

    // SPI-1 من السلسلة المحسوبة مسبقاً إن لم نحتج إعادة التجميع
    if (scale === 1 && result.drought.spiSeries && result.drought.spiSeries.length && (!region || region === 'all')) {
      var series = result.drought.spiSeries;
      var nums = [];
      for (var i = 0; i < series.length; i++) {
        if (series[i] != null && isFinite(series[i])) nums.push(series[i]);
      }
      var latest = nums.length ? nums[nums.length - 1] : result.drought.latestSpi;
      var prev = nums.length > 1 ? nums[nums.length - 2] : null;
      if (latest == null || !isFinite(latest)) {
        fail('تعذر استخراج SPI من نتيجة التحليل');
        return;
      }
      mount(root, {
        spi: latest,
        prevSpi: prev,
        scale: 1,
        region: 'كامل السلسلة',
        date: (result.meta && (result.meta.runAt || result.meta.at) || new Date().toISOString()).toString().slice(0, 10),
        source: result.meta && result.meta.isDemo ? 'بيانات تجريبية موسومة' : 'بيانات مستخدم',
        reliability: result.drought.method || 'محسوب',
        kind: 'current'
      });
      return;
    }

    if (!rainfall || !rainfall.length) {
      // آخر فرصة: latestSpi فقط
      if (result.drought.latestSpi != null && isFinite(result.drought.latestSpi)) {
        mount(root, {
          spi: result.drought.latestSpi,
          prevSpi: null,
          scale: 1,
          region: region === 'all' ? 'كامل السلسلة' : region,
          date: (result.meta && result.meta.runAt || '').toString().slice(0, 10) || '—',
          source: result.meta && result.meta.isDemo ? 'تجريبي' : 'مستخدم',
          reliability: result.drought.method || '—',
          kind: 'current'
        });
      } else {
        fail('لا توجد سلسلة هطول لحساب SPI');
      }
      return;
    }

    var out = spiForScale(rainfall, scale);
    if (out.error || out.latest == null || !isFinite(out.latest)) {
      fail(out.error === 'insufficient_data'
        ? ('بيانات غير كافية لـ SPI-' + scale + ' (نقاط: ' + (out.valid || 0) + ')')
        : (out.error || 'تعذر حساب SPI'));
      return;
    }
    mount(root, {
      spi: out.latest,
      prevSpi: out.prev,
      scale: scale,
      region: region === 'all' ? 'كامل السلسلة' : region,
      date: new Date().toISOString().slice(0, 10),
      source: result.meta && result.meta.isDemo ? 'بيانات تجريبية موسومة' : 'محرك SPI',
      reliability: out.method || 'محسوب',
      kind: 'current'
    });
  }

  function bindControls() {
    const scaleSel = document.getElementById('spi-scale-select');
    const regionSel = document.getElementById('spi-region-select');
    const handler = () => {
      const prev = (typeof AnalysisEngine !== 'undefined' && AnalysisEngine.loadStoredAnalysis)
        ? AnalysisEngine.loadStoredAnalysis() : window.__lastAnalysisResult;
      updateFromAnalysis(prev || window.__lastAnalysisResult, {
        scale: scaleSel && scaleSel.value,
        region: regionSel && regionSel.value
      });
    };
    if (scaleSel) scaleSel.onchange = handler;
    if (regionSel) regionSel.onchange = handler;

    // ملء المناطق من البيانات
    if (regionSel && typeof AnalysisEngine !== 'undefined' && AnalysisEngine.loadDataset) {
      const ds = AnalysisEngine.loadDataset();
      if (ds && ds.rows) {
        const set = new Set();
        ds.rows.forEach(r => {
          const name = r.region || r.name;
          if (name) set.add(String(name));
        });
        const cur = regionSel.value;
        regionSel.innerHTML = '<option value="all">كل المناطق</option>' +
          [...set].map(n => `<option value="${n.replace(/"/g, '')}">${n}</option>`).join('');
        if (cur) regionSel.value = cur;
      }
    }
  }

  global.SpiGauge = {
    classifySPI,
    renderGaugeSVG,
    mount,
    spiForScale,
    updateFromAnalysis,
    bindControls
  };
})(typeof window !== 'undefined' ? window : globalThis);
