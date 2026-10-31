/**
 * DataHub — مصدر البيانات الموحّد لمنصة Mā’ Risk (صفحة البيانات)
 */
(function (global) {
  'use strict';

  const LS_KEY = 'maarisk_datasets_v20';
  const ACTIVE_KEY = 'maarisk_active_dataset_id';
  const DEMO_ID = 'ds_demo_fixed_v20';
  const IDB_NAME = 'maarisk_v20';
  const IDB_STORE = 'datasets';

  const STANDARD_FIELDS = [
    'date', 'region', 'station', 'rainfall_mm', 'temperature_c',
    'demand_m3', 'supply_m3', 'health_index', 'population', 'lat', 'lng'
  ];

  function uid() {
    return 'ds_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }
  function now() { return new Date().toISOString(); }

  function loadAll() {
    try {
      const list = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function saveAll(list) {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
    try {
      if (!global.indexedDB) return;
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.clear();
        list.forEach(function (d) { store.put(d); });
      };
    } catch (e) {}
  }
  function getById(id) { return loadAll().find(function (d) { return d.id === id; }) || null; }

  function normalizeRow(raw) {
    if (!raw || typeof raw !== 'object') return null;
    function pick() {
      var names = arguments;
      var keys = Object.keys(raw);
      for (var i = 0; i < names.length; i++) {
        var n = names[i];
        var k = keys.find(function (x) { return x.toLowerCase() === n.toLowerCase(); });
        if (k != null && raw[k] !== '' && raw[k] != null) return raw[k];
      }
      return null;
    }
    function num(v) {
      if (v === '' || v == null) return null;
      var n = Number(String(v).replace(',', '.'));
      return isFinite(n) ? n : null;
    }
    var date = pick('date', 'Date', 'month', 'year');
    if (raw.year && raw.month) date = String(raw.year) + '-' + String(raw.month).padStart(2, '0');
    var row = {
      date: date != null ? String(date) : null,
      region: (function () { var v = pick('region', 'region_name', 'region_id', 'area'); return v != null ? String(v) : null; })(),
      station: (function () { var v = pick('station', 'station_id', 'station_name'); return v != null ? String(v) : null; })(),
      rainfall_mm: num(pick('rainfall_mm', 'rainfall', 'precip', 'precipitation', 'rain')),
      temperature_c: num(pick('temperature_c', 'temp', 'tmax', 'tavg', 'temperature', 'avg_temp_c')),
      demand_m3: num(pick('demand_m3', 'demand', 'water_demand')),
      supply_m3: num(pick('supply_m3', 'supply', 'surface_water_m3', 'water_supply')),
      health_index: num(pick('health_index', 'health', 'diarrhea_cases_per_1000', 'malnutrition_rate_pct')),
      population: num(pick('population', 'pop')),
      lat: num(pick('lat', 'latitude')),
      lng: num(pick('lng', 'lon', 'longitude'))
    };
    var hasAny = Object.keys(row).some(function (k) { return row[k] != null && row[k] !== ''; });
    return hasAny ? row : null;
  }

  function toAnalysisRows(rows) {
    return (rows || []).map(function (r) {
      return {
        region: r.region || r.station || '—',
        date: r.date,
        rainfall: r.rainfall_mm,
        temp: r.temperature_c,
        demand: r.demand_m3,
        supply: r.supply_m3,
        health_index: r.health_index,
        population: r.population,
        lat: r.lat,
        lng: r.lng,
        station: r.station
      };
    });
  }

  function qualityScan(rows) {
    var issues = [];
    var n = rows.length;
    if (!n) {
      issues.push({ level: 'error', msg: 'لا سجلات' });
      return { issues: issues, recordCount: 0, missing: 0, duplicates: 0, outliers: 0 };
    }
    var missing = 0, duplicates = 0, outliers = 0;
    var seen = {};
    var rains = [];
    rows.forEach(function (r) {
      if (r.rainfall_mm == null || r.date == null) missing++;
      var key = [r.date, r.region, r.station, r.rainfall_mm].join('|');
      if (seen[key]) duplicates++; else seen[key] = 1;
      if (r.rainfall_mm != null) rains.push(r.rainfall_mm);
    });
    if (rains.length >= 8) {
      var sorted = rains.slice().sort(function (a, b) { return a - b; });
      var q1 = sorted[Math.floor(sorted.length * 0.25)];
      var q3 = sorted[Math.floor(sorted.length * 0.75)];
      var iqr = q3 - q1 || 1;
      rains.forEach(function (v) { if (v < q1 - 3 * iqr || v > q3 + 3 * iqr) outliers++; });
    }
    if (missing) issues.push({ level: 'warn', msg: 'قيم ناقصة مهمة: ' + missing });
    if (duplicates) issues.push({ level: 'warn', msg: 'تكرارات محتملة: ' + duplicates });
    if (outliers) issues.push({ level: 'info', msg: 'قيم شاذة (لم تُحذف): ' + outliers });
    var regions = {};
    rows.forEach(function (r) { if (r.region) regions[r.region] = 1; });
    var regionCount = Object.keys(regions).length;
    if (regionCount > 1) issues.push({ level: 'warn', msg: 'عدة مناطق: ' + regionCount });
    return { issues: issues, recordCount: n, missing: missing, duplicates: duplicates, outliers: outliers, regions: regionCount };
  }

  function emptyDataset(partial) {
    return Object.assign({
      id: uid(), name: 'مجموعة', type: 'climate', source: '', country: '', region: '', station: '',
      periodStart: '', periodEnd: '', period: '', spatialAccuracy: '', temporalAccuracy: '',
      quality: 'medium', license: '', notes: '', recordCount: 0, updatedAt: now(), createdAt: now(),
      dataKind: 'actual', status: 'documented', rows: [], version: 1, importReport: null
    }, partial || {});
  }

  function upsert(ds) {
    var list = loadAll();
    var i = list.findIndex(function (x) { return x.id === ds.id; });
    ds.updatedAt = now();
    ds.recordCount = (ds.rows && ds.rows.length) || 0;
    if (i >= 0) { ds.version = (list[i].version || 1) + 1; list[i] = ds; }
    else list.unshift(ds);
    saveAll(list);
    return ds;
  }
  function remove(id) {
    saveAll(loadAll().filter(function (d) { return d.id !== id; }));
    if (localStorage.getItem(ACTIVE_KEY) === id) localStorage.removeItem(ACTIVE_KEY);
  }

  function parseDelimited(text) {
    var lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (!lines.length) return { ok: false, error: 'نص فارغ' };
    var delim = (lines[0].match(/\t/g) || []).length >= (lines[0].match(/,/g) || []).length ? '\t' : ',';
    function splitLine(line) {
      var out = [], cur = '', inQ = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (ch === delim && !inQ) { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out.map(function (s) { return s.trim(); });
    }
    var headers = splitLine(lines[0]);
    var rows = [], invalid = [];
    for (var i = 1; i < lines.length; i++) {
      var cells = splitLine(lines[i]);
      if (cells.every(function (c) { return !c; })) continue;
      var obj = {};
      headers.forEach(function (h, j) { obj[h] = cells[j] != null ? cells[j] : ''; });
      var norm = normalizeRow(obj);
      if (norm) rows.push(norm);
      else invalid.push({ line: i + 1 });
    }
    return { ok: true, headers: headers, rows: rows, invalid: invalid };
  }

  function createFromRows(meta, rows, extra) {
    var q = qualityScan(rows);
    return upsert(emptyDataset(Object.assign({}, meta, {
      rows: rows,
      recordCount: rows.length,
      status: rows.length ? 'imported' : 'documented',
      importReport: {
        accepted: rows.length,
        rejected: (extra && extra.rejected) || 0,
        warnings: q.issues,
        at: now()
      }
    })));
  }

  function buildDemoRows() {
    var rows = [];
    for (var y = 2018; y <= 2023; y++) {
      for (var m = 1; m <= 12; m++) {
        var season = Math.sin((m - 1) / 12 * Math.PI * 2);
        var rainfall_mm = Math.max(0, +(15 + 12 * season + ((y * 12 + m) % 7) - 3 - (y - 2018) * 0.4).toFixed(1));
        var temperature_c = +(18 + 10 * Math.sin((m - 3) / 12 * Math.PI * 2) + (y - 2018) * 0.05).toFixed(1);
        var supply_m3 = Math.round(90000 + rainfall_mm * 1200);
        var demand_m3 = Math.round(100000 + (y - 2018) * 2500 + (m > 5 && m < 10 ? 8000 : 0));
        rows.push({
          date: y + '-' + String(m).padStart(2, '0'),
          region: 'حوض تجريبي',
          station: 'محطة تجريبية-1',
          rainfall_mm: rainfall_mm,
          temperature_c: temperature_c,
          demand_m3: demand_m3,
          supply_m3: supply_m3,
          health_index: +(12 + Math.max(0, -((rainfall_mm - 15) / 5)) * 3 + (demand_m3 > supply_m3 ? 4 : 0)).toFixed(1),
          population: 12000 + (y - 2018) * 200,
          lat: 30.2, lng: 35.73
        });
      }
    }
    return rows;
  }

  function loadOrRefreshDemo() {
    var rows = buildDemoRows();
    var existing = getById(DEMO_ID);
    return upsert(emptyDataset({
      id: DEMO_ID,
      name: 'بيانات تجريبية — سلسلة شهرية 2018–2023',
      type: 'climate',
      source: 'مولّد داخلي (Mā’ Risk demo)',
      region: 'حوض تجريبي',
      station: 'محطة تجريبية-1',
      periodStart: '2018-01',
      periodEnd: '2023-12',
      period: '2018-01 → 2023-12',
      quality: 'medium',
      dataKind: 'demo',
      status: 'ready',
      rows: rows,
      recordCount: rows.length,
      notes: 'بيانات مولَّدة للتوضيح فقط — ليست سجلات ميدانية.',
      license: 'داخلي / تجريبي',
      version: existing ? (existing.version || 1) + 1 : 1
    }));
  }

  function readiness() {
    var list = loadAll();
    var activeId = localStorage.getItem(ACTIVE_KEY);
    var active = activeId ? getById(activeId) : null;
    var pool = active && active.rows && active.rows.length ? [active] : list.filter(function (d) { return d.rows && d.rows.length; });
    var allRows = [];
    pool.forEach(function (d) { allRows = allRows.concat(d.rows || []); });
    var rainN = allRows.filter(function (r) { return r.rainfall_mm != null; }).length;
    var waterN = allRows.filter(function (r) { return r.demand_m3 != null && r.supply_m3 != null; }).length;
    var healthN = allRows.filter(function (r) { return r.health_index != null; }).length;
    var regions = {};
    allRows.forEach(function (r) { if (r.region) regions[r.region] = 1; });
    var regionCount = Object.keys(regions).length;
    function st(ready, limited, reason) {
      if (ready && !limited) return { state: 'ready', reason: reason };
      if (ready && limited) return { state: 'limited', reason: reason };
      return { state: 'not_ready', reason: reason };
    }
    var spi = rainN >= 24 && regionCount <= 1
      ? st(true, false, 'أمطار كافية · منطقة واحدة')
      : rainN >= 6 ? st(true, true, 'قيود: ' + rainN + ' قراءة · مناطق ' + regionCount)
      : st(false, false, 'يلزم ≥6 قراءات مطر');
    var drought = rainN >= 6 ? st(true, regionCount > 1 || rainN < 24, 'من بيانات الهطول') : st(false, false, 'لا أمطار');
    var water = waterN >= 3 ? st(true, false, 'عرض وطلب') : rainN >= 6 ? st(true, true, 'تقريب من الهطول') : st(false, false, 'لا عرض/طلب');
    var health = healthN >= 3 ? st(true, false, 'مؤشر صحي') : st(false, false, 'لا health_index');
    var composite = spi.state !== 'not_ready' ? st(true, spi.state === 'limited', 'من المؤشرات الفرعية') : st(false, false, 'مدخلات ناقصة');
    return {
      activeId: activeId, activeName: active ? active.name : null, storage: 'local',
      datasets: list.length,
      records: list.reduce(function (s, d) { return s + (d.recordCount || 0); }, 0),
      engines: { spi: spi, drought: drought, water: water, health: health, composite: composite }
    };
  }

  function activateForAnalysis(id) {
    var ds = getById(id);
    if (!ds) return { ok: false, error: 'المجموعة غير موجودة' };
    if (!ds.rows || !ds.rows.length) return { ok: false, error: 'لا قراءات — التوثيق وحده لا يكفي' };
    var regions = {};
    ds.rows.forEach(function (r) { if (r.region) regions[r.region] = 1; });
    if (Object.keys(regions).length > 1) {
      return { ok: false, error: 'عدة مناطق في المجموعة — افصلها قبل الاعتماد' };
    }
    localStorage.setItem(ACTIVE_KEY, id);
    ds.status = 'ready';
    upsert(ds);
    var payload = {
      source: ds.dataKind === 'demo' ? 'demo' : 'user',
      rows: toAnalysisRows(ds.rows),
      label: ds.name,
      datasetId: ds.id,
      dataKind: ds.dataKind,
      importedAt: now()
    };
    if (typeof AnalysisEngine !== 'undefined' && AnalysisEngine.saveDataset) AnalysisEngine.saveDataset(payload);
    else localStorage.setItem('maarisk_analysis_dataset', JSON.stringify(payload));
    return { ok: true, dataset: ds, payload: payload };
  }

  var importing = false;
  function importTextFile(name, text, meta) {
    var lower = (name || '').toLowerCase();
    if (lower.endsWith('.json') || lower.endsWith('.geojson')) {
      try {
        var data = JSON.parse(text);
        var rawRows = Array.isArray(data) ? data : (data.features ? data.features.map(function (f) {
          return Object.assign({}, f.properties || {}, {
            lat: f.geometry && f.geometry.coordinates && f.geometry.coordinates[1],
            lng: f.geometry && f.geometry.coordinates && f.geometry.coordinates[0]
          });
        }) : (data.rows || []));
        var rows = rawRows.map(normalizeRow).filter(Boolean);
        if (!rows.length) return { ok: false, error: 'JSON بلا سجلات صالحة' };
        return { ok: true, dataset: createFromRows(Object.assign({ name: name, type: 'spatial', source: name, dataKind: 'actual' }, meta || {}), rows) };
      } catch (e) { return { ok: false, error: 'JSON: ' + e.message }; }
    }
    var parsed = parseDelimited(text);
    if (!parsed.ok) return parsed;
    if (!parsed.rows.length) return { ok: false, error: 'لا صفوف صالحة من ' + name };
    return {
      ok: true,
      dataset: createFromRows(Object.assign({
        name: (meta && meta.name) || name, type: 'climate', source: name, dataKind: 'actual',
        notes: 'أعمدة: ' + (parsed.headers || []).join(', ')
      }, meta || {}), parsed.rows, { rejected: parsed.invalid.length })
    };
  }

  function importFiles(fileList) {
    if (importing) return Promise.resolve({ ok: false, error: 'استيراد جارٍ' });
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return Promise.resolve({ ok: false, error: 'لا ملفات' });
    importing = true;
    function readOne(file) {
      var lower = (file.name || '').toLowerCase();
      return new Promise(function (resolve) {
        if (lower.endsWith('.shp') || lower.endsWith('.nc')) {
          resolve({ ok: false, file: file.name, error: 'Shapefile/NetCDF يحتاجان خادماً — استخدم CSV/Excel/GeoJSON' });
          return;
        }
        if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
          if (global.XLSX) {
            var reader = new FileReader();
            reader.onload = function () {
              try {
                var wb = XLSX.read(reader.result, { type: 'array' });
                var sheet = wb.Sheets[wb.SheetNames[0]];
                var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                var rows = json.map(normalizeRow).filter(Boolean);
                if (!rows.length) { resolve({ ok: false, file: file.name, error: 'Excel بلا صفوف' }); return; }
                resolve({ ok: true, file: file.name, dataset: createFromRows({ name: file.name, source: file.name, dataKind: 'actual' }, rows) });
              } catch (e) { resolve({ ok: false, file: file.name, error: e.message }); }
            };
            reader.onerror = function () { resolve({ ok: false, file: file.name, error: 'فشل القراءة' }); };
            reader.readAsArrayBuffer(file);
            return;
          }
          resolve({ ok: false, file: file.name, error: 'Excel يتطلب SheetJS أو صدّر CSV' });
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          var r = importTextFile(file.name, String(reader.result || ''), {});
          resolve(Object.assign({ file: file.name }, r));
        };
        reader.onerror = function () { resolve({ ok: false, file: file.name, error: 'فشل FileReader' }); };
        reader.readAsText(file, 'UTF-8');
      });
    }
    return Promise.all(files.map(readOne)).then(function (list) {
      importing = false;
      return { ok: list.some(function (x) { return x.ok; }), results: list };
    }).catch(function (err) {
      importing = false;
      return { ok: false, error: String(err) };
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toast(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type);
    else console.log(msg);
  }

  function renderReadiness() {
    var el = document.getElementById('data-readiness-panel');
    if (!el) return;
    var r = readiness();
    function badge(s) {
      if (s === 'ready') return '<span class="badge badge-success">جاهز</span>';
      if (s === 'limited') return '<span class="badge badge-warning">بشروط</span>';
      return '<span class="badge badge-danger">غير جاهز</span>';
    }
    var eng = r.engines;
    el.innerHTML = '<p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:10px;">المجموعة المعتمدة: <strong>' +
      esc(r.activeName || 'لا يوجد') + '</strong> · مجموعات: ' + r.datasets + ' · سجلات: ' + r.records + '</p>' +
      '<div class="kpi-grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));">' +
      '<div class="kpi"><div class="kpi-label">SPI</div>' + badge(eng.spi.state) + '<div class="kpi-meta">' + esc(eng.spi.reason) + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">الجفاف</div>' + badge(eng.drought.state) + '<div class="kpi-meta">' + esc(eng.drought.reason) + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">شح المياه</div>' + badge(eng.water.state) + '<div class="kpi-meta">' + esc(eng.water.reason) + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">الصحة</div>' + badge(eng.health.state) + '<div class="kpi-meta">' + esc(eng.health.reason) + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">المركّب</div>' + badge(eng.composite.state) + '<div class="kpi-meta">' + esc(eng.composite.reason) + '</div></div></div>';
  }

  function renderTable() {
    var tbody = document.querySelector('#datasets-table tbody');
    if (!tbody) return;
    var list = loadAll();
    var filterType = (document.getElementById('filter-type') || {}).value || '';
    var filterKind = (document.getElementById('filter-kind') || {}).value || '';
    var q = ((document.getElementById('filter-search') || {}).value || '').trim().toLowerCase();
    var filtered = list.filter(function (d) {
      if (filterType && d.type !== filterType) return false;
      if (filterKind && d.dataKind !== filterKind) return false;
      if (q && !(d.name || '').toLowerCase().includes(q) && !(d.source || '').toLowerCase().includes(q)) return false;
      return true;
    });
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-secondary);padding:20px;">لا مجموعات بعد</td></tr>';
      return;
    }
    var active = localStorage.getItem(ACTIVE_KEY);
    tbody.innerHTML = filtered.map(function (d) {
      var kindLabel = d.dataKind === 'demo' ? 'تجريبي' : d.dataKind === 'derived' ? 'مشتق' : 'فعلي';
      var statusLabel = { documented: 'توثيق فقط', imported: 'مستورد', reviewed: 'مفحوص', ready: 'جاهز' }[d.status] || d.status;
      return '<tr data-id="' + esc(d.id) + '"' + (active === d.id ? ' style="outline:2px solid var(--accent)"' : '') + '>' +
        '<td>' + esc(d.name) + (d.dataKind === 'demo' ? ' <span class="badge badge-warning">تجريبي</span>' : '') + '</td>' +
        '<td>' + esc(d.type) + '</td><td>' + esc(d.source || '—') + '</td>' +
        '<td>' + esc(d.period || '—') + '</td><td>' + esc(d.quality) + '</td>' +
        '<td>' + (d.recordCount || 0) + '</td><td>' + kindLabel + '<br><small>' + statusLabel + '</small></td>' +
        '<td colspan="2" style="white-space:nowrap;">' +
        '<button type="button" class="btn btn-sm btn-outline" data-act="preview" data-id="' + esc(d.id) + '">معاينة</button> ' +
        '<button type="button" class="btn btn-sm btn-primary" data-act="activate" data-id="' + esc(d.id) + '">اعتماد</button> ' +
        '<button type="button" class="btn btn-sm btn-outline" data-act="delete" data-id="' + esc(d.id) + '">حذف</button></td></tr>';
    }).join('');
    tbody.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-id');
        var act = btn.getAttribute('data-act');
        if (act === 'delete') {
          if (confirm('حذف المجموعة؟')) { remove(id); refreshUI(); toast('تم الحذف'); }
        } else if (act === 'activate') {
          var ds = getById(id);
          if (ds && ds.dataKind === 'demo' && !confirm('بيانات تجريبية — المتابعة؟')) return;
          var res = activateForAnalysis(id);
          if (!res.ok) toast(res.error, 'warning');
          else { toast('تم الاعتماد: ' + res.dataset.name); refreshUI(); }
        } else if (act === 'preview') {
          var d = getById(id);
          var pre = document.getElementById('dataset-preview');
          if (pre && d) {
            pre.style.display = 'block';
            pre.innerHTML = '<h4>معاينة: ' + esc(d.name) + ' (' + d.recordCount + ')</h4><pre style="font-size:0.75rem;max-height:200px;overflow:auto;background:var(--surface-2);padding:10px;border-radius:8px;">' +
              esc(JSON.stringify((d.rows || []).slice(0, 8), null, 2)) + '</pre>';
          }
        }
      };
    });
  }

  function fillLinkSelect() {
    var sel = document.getElementById('meta-link-dataset');
    if (!sel) return;
    var v = sel.value;
    sel.innerHTML = '<option value="">— مجموعة جديدة (توثيق فقط) —</option>' +
      loadAll().map(function (d) { return '<option value="' + esc(d.id) + '">' + esc(d.name) + ' (' + (d.recordCount || 0) + ')</option>'; }).join('');
    if (v) sel.value = v;
  }

  function refreshUI() {
    var ban = document.getElementById('data-storage-banner');
    if (ban) ban.innerHTML = '<strong>التخزين:</strong> محلي على هذا المتصفح/الجهاز — ليس قاعدة مؤسسية مركزية.';
    renderReadiness();
    renderTable();
    fillLinkSelect();
  }

  var bound = false;
  function bindUI() {
    if (bound) return;
    bound = true;

    var input = document.getElementById('file-input');
    var zone = document.getElementById('upload-zone');
    if (input && !input.dataset.datahubBound) {
      input.dataset.datahubBound = '1';
      // عند وجود مسار Wizard لا نستورد هنا — المعالج في bindWorkflow
      if (!document.getElementById('wf-step-1')) {
        input.addEventListener('change', function () {
          if (!input.files || !input.files.length) return;
          toast('جاري الاستيراد…');
          importFiles(input.files).then(function (res) {
            input.value = '';
            (res.results || []).forEach(function (r) {
              toast(r.ok ? ('✓ ' + r.file + ': ' + (r.dataset && r.dataset.recordCount) + ' سجل') : ('✗ ' + (r.error || '')), r.ok ? undefined : 'warning');
            });
            refreshUI();
          });
        });
      }
    }
    if (zone && input && !zone.dataset.datahubBound) {
      zone.dataset.datahubBound = '1';
      zone.addEventListener('click', function (e) { if (!e.target.closest('a')) input.click(); });
      zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('dragover'); });
      zone.addEventListener('dragleave', function () { zone.classList.remove('dragover'); });
      zone.addEventListener('drop', function (e) {
        e.preventDefault(); zone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          importFiles(e.dataTransfer.files).then(function (res) {
            (res.results || []).forEach(function (r) { toast(r.ok ? ('✓ ' + r.file) : ('✗ ' + r.error), r.ok ? undefined : 'warning'); });
            refreshUI();
          });
        }
      });
    }

    var demoBtn = document.getElementById('btn-demo-data');
    if (demoBtn) demoBtn.onclick = function () {
      var ds = loadOrRefreshDemo();
      toast('تجريبي: ' + ds.recordCount + ' سجل (معرف ثابت)');
      refreshUI();
    };

    var addBtn = document.getElementById('btn-add-manual');
    var panel = document.getElementById('manual-entry-panel');
    if (addBtn && panel) addBtn.onclick = function () {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    };

    var readingsBody = document.getElementById('manual-readings-body');
    function addReadingRow(values) {
      if (!readingsBody) return;
      values = values || {};
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><input class="form-control" data-f="date" value="' + esc(values.date || '') + '" placeholder="YYYY-MM"></td>' +
        '<td><input class="form-control" data-f="region" value="' + esc(values.region || '') + '"></td>' +
        '<td><input class="form-control" data-f="station" value="' + esc(values.station || '') + '"></td>' +
        '<td><input type="number" step="any" class="form-control" data-f="rainfall_mm" value="' + (values.rainfall_mm != null ? values.rainfall_mm : '') + '"></td>' +
        '<td><input type="number" step="any" class="form-control" data-f="temperature_c" value="' + (values.temperature_c != null ? values.temperature_c : '') + '"></td>' +
        '<td><input type="number" step="any" class="form-control" data-f="demand_m3" value="' + (values.demand_m3 != null ? values.demand_m3 : '') + '"></td>' +
        '<td><input type="number" step="any" class="form-control" data-f="supply_m3" value="' + (values.supply_m3 != null ? values.supply_m3 : '') + '"></td>' +
        '<td><input type="number" step="any" class="form-control" data-f="health_index" value="' + (values.health_index != null ? values.health_index : '') + '"></td>' +
        '<td><button type="button" class="btn btn-sm btn-outline" data-remove-row>×</button></td>';
      readingsBody.appendChild(tr);
      tr.querySelector('[data-remove-row]').onclick = function () { tr.remove(); };
    }
    var addRowBtn = document.getElementById('btn-add-reading-row');
    if (addRowBtn) addRowBtn.onclick = function () { addReadingRow(); };
    if (readingsBody && !readingsBody.children.length) addReadingRow();

    var saveReadings = document.getElementById('btn-save-readings');
    if (saveReadings) saveReadings.onclick = function () {
      var rows = [];
      if (readingsBody) readingsBody.querySelectorAll('tr').forEach(function (tr) {
        var obj = {};
        tr.querySelectorAll('[data-f]').forEach(function (inp) { obj[inp.getAttribute('data-f')] = inp.value; });
        var norm = normalizeRow(obj);
        if (norm) rows.push(norm);
      });
      if (!rows.length) { toast('لا صفوف صالحة', 'warning'); return; }
      var kind = (document.getElementById('manual-data-kind') || {}).value || 'actual';
      var linkId = (document.getElementById('meta-link-dataset') || {}).value;
      if (linkId) {
        var ds = getById(linkId);
        if (!ds) { toast('المجموعة غير موجودة', 'warning'); return; }
        ds.rows = (ds.rows || []).concat(rows);
        ds.dataKind = kind;
        ds.status = 'imported';
        upsert(ds);
        toast('أُضيف ' + rows.length + ' صفاً');
      } else {
        createFromRows({
          name: (document.getElementById('meta-name') || {}).value.trim() || ('إدخال يدوي ' + new Date().toLocaleDateString('ar')),
          type: (document.getElementById('meta-type') || {}).value || 'climate',
          source: (document.getElementById('meta-source') || {}).value || 'إدخال يدوي',
          country: (document.getElementById('meta-country') || {}).value || '',
          dataKind: kind
        }, rows);
        toast('مجموعة جديدة: ' + rows.length + ' سجل');
      }
      refreshUI();
    };

    var pasteBtn = document.getElementById('btn-parse-paste');
    if (pasteBtn) pasteBtn.onclick = function () {
      var text = (document.getElementById('paste-excel-area') || {}).value || '';
      var parsed = parseDelimited(text);
      if (!parsed.ok) { toast(parsed.error, 'warning'); return; }
      var preview = document.getElementById('paste-preview');
      if (preview) {
        preview.style.display = 'block';
        preview.innerHTML = '<p>أعمدة: <code>' + esc((parsed.headers || []).join(' | ')) + '</code> · صالحة: ' + parsed.rows.length + ' · مرفوضة: ' + parsed.invalid.length + '</p>' +
          '<button type="button" class="btn btn-primary btn-sm" id="btn-confirm-paste">تأكيد الاستيراد</button>';
        document.getElementById('btn-confirm-paste').onclick = function () {
          createFromRows({
            name: (document.getElementById('meta-name') || {}).value.trim() || ('لصق ' + Date.now()),
            source: 'لصق Excel',
            dataKind: (document.getElementById('manual-data-kind') || {}).value || 'actual'
          }, parsed.rows, { rejected: parsed.invalid.length });
          toast('استيراد: ' + parsed.rows.length);
          refreshUI();
        };
      }
    };

    var metaForm = document.getElementById('add-meta-form');
    if (metaForm && !metaForm.dataset.datahubBound) {
      metaForm.dataset.datahubBound = '1';
      metaForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = (document.getElementById('meta-name') || {}).value.trim();
        if (!name) { toast('اسم المجموعة مطلوب', 'warning'); return; }
        var patch = {
          name: name,
          type: (document.getElementById('meta-type') || {}).value || 'climate',
          source: (document.getElementById('meta-source') || {}).value.trim(),
          country: (document.getElementById('meta-country') || {}).value || '',
          region: (document.getElementById('meta-region-meta') || {}).value || '',
          station: (document.getElementById('meta-station') || {}).value || '',
          periodStart: (document.getElementById('meta-period-start') || {}).value || '',
          periodEnd: (document.getElementById('meta-period-end') || {}).value || '',
          period: (document.getElementById('meta-period') || {}).value.trim(),
          spatialAccuracy: (document.getElementById('meta-spatial') || {}).value || '',
          temporalAccuracy: (document.getElementById('meta-temporal') || {}).value || '',
          quality: (document.getElementById('meta-quality') || {}).value || 'medium',
          license: (document.getElementById('meta-license') || {}).value || '',
          notes: (document.getElementById('meta-notes') || {}).value || ''
        };
        if (patch.periodStart || patch.periodEnd) patch.period = (patch.periodStart || '') + (patch.periodEnd ? ' → ' + patch.periodEnd : '');
        var linkId = (document.getElementById('meta-link-dataset') || {}).value;
        if (linkId) {
          var ds = getById(linkId);
          if (!ds) { toast('غير موجودة', 'warning'); return; }
          Object.assign(ds, patch);
          if (!ds.rows || !ds.rows.length) ds.status = 'documented';
          upsert(ds);
          toast('تم تحديث التوثيق');
        } else {
          upsert(emptyDataset(Object.assign(patch, { rows: [], status: 'documented', dataKind: 'actual' })));
          toast('توثيق فقط — بلا قراءات');
        }
        refreshUI();
      });
    }

    ['filter-search', 'filter-type', 'filter-kind'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.addEventListener('input', renderTable); el.addEventListener('change', renderTable); }
    });
    document.querySelectorAll('[data-action="save"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        saveAll(loadAll());
        toast('حُفظ محلياً (' + loadAll().length + ' مجموعة)');
      });
    });

    refreshUI();
  }

  global.DataHub = {
    STANDARD_FIELDS: STANDARD_FIELDS, loadAll: loadAll, getById: getById, upsert: upsert, remove: remove,
    normalizeRow: normalizeRow, toAnalysisRows: toAnalysisRows, qualityScan: qualityScan, parseDelimited: parseDelimited,
    importFiles: importFiles, importTextFile: importTextFile, loadOrRefreshDemo: loadOrRefreshDemo,
    activateForAnalysis: activateForAnalysis, readiness: readiness, refreshUI: refreshUI, bindUI: bindUI, createFromRows: createFromRows
  };

  global.maariskHandleFiles = function (fileList) {
    return DataHub.importFiles(fileList).then(function (res) {
      if (DataHub.refreshUI) DataHub.refreshUI();
      return res;
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (document.body && document.body.dataset.page === 'data') bindUI();
  });
})(typeof window !== 'undefined' ? window : globalThis);

/* ========== مسار العمل المتتابع (Wizard) ========== */
(function (global) {
  if (!global.DataHub) return;

  var STANDARD = [
    { key: 'date', label: 'التاريخ (date)' },
    { key: 'region', label: 'المنطقة (region)' },
    { key: 'station', label: 'المحطة (station)' },
    { key: 'rainfall_mm', label: 'الأمطار mm' },
    { key: 'temperature_c', label: 'الحرارة °C' },
    { key: 'humidity_pct', label: 'الرطوبة %' },
    { key: 'demand_m3', label: 'الطلب m³' },
    { key: 'supply_m3', label: 'العرض m³' },
    { key: 'health_index', label: 'مؤشر صحي' },
    { key: 'population', label: 'السكان' },
    { key: 'lat', label: 'خط العرض' },
    { key: 'lng', label: 'خط الطول' },
    { key: '_ignore', label: '— تجاهل —' }
  ];

  var ALIASES = {
    date: ['date', 'month', 'year', 'time', 'period'],
    region: ['region', 'region_name', 'area', 'zone'],
    station: ['station', 'station_id', 'station_name'],
    rainfall_mm: ['rainfall_mm', 'rainfall', 'precip', 'precipitation', 'rain'],
    temperature_c: ['temperature_c', 'temp', 'tmax', 'tavg', 'temperature'],
    humidity_pct: ['humidity_pct', 'humidity', 'rh'],
    demand_m3: ['demand_m3', 'demand', 'water_demand'],
    supply_m3: ['supply_m3', 'supply', 'water_supply'],
    health_index: ['health_index', 'health', 'diarrhea_cases_per_1000'],
    population: ['population', 'pop'],
    lat: ['lat', 'latitude'],
    lng: ['lng', 'lon', 'longitude']
  };

  var state = {
    step: 1,
    headers: [],
    rawRows: [],
    mapping: {},
    mappedRows: [],
    quality: null,
    meta: { name: '', source: '', dataKind: 'actual' },
    draftId: null
  };

  function toast(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type);
  }

  function goStep(n) {
    state.step = n;
    for (var i = 1; i <= 4; i++) {
      var panel = document.getElementById('wf-step-' + i);
      if (panel) panel.style.display = i === n ? 'block' : 'none';
      var btn = document.querySelector('[data-step-btn="' + i + '"]');
      if (btn) {
        btn.disabled = i > n && i > state.step;
        if (i < n) { btn.disabled = false; btn.className = 'btn btn-sm btn-outline'; }
        if (i === n) { btn.disabled = false; btn.className = 'btn btn-sm btn-primary'; }
        if (i > n) { btn.className = 'btn btn-sm btn-outline'; btn.disabled = true; }
      }
    }
    // unlock previous
    for (var j = 1; j <= n; j++) {
      var b = document.querySelector('[data-step-btn="' + j + '"]');
      if (b) b.disabled = false;
    }
  }

  function autoMap(headers) {
    var map = {};
    headers.forEach(function (h) {
      var hl = String(h).toLowerCase().trim();
      var found = '_ignore';
      Object.keys(ALIASES).forEach(function (std) {
        ALIASES[std].forEach(function (a) {
          if (hl === a || hl.replace(/\s/g, '_') === a) found = std;
        });
      });
      map[h] = found;
    });
    return map;
  }

  function applyMapping() {
    var rows = [];
    state.rawRows.forEach(function (raw) {
      var obj = {};
      Object.keys(state.mapping).forEach(function (src) {
        var dest = state.mapping[src];
        if (!dest || dest === '_ignore') return;
        obj[dest] = raw[src];
      });
      var norm = DataHub.normalizeRow(obj);
      if (norm) rows.push(norm);
    });
    state.mappedRows = rows;
    return rows;
  }

  function showPreview() {
    var meta = document.getElementById('wf-preview-meta');
    var thead = document.querySelector('#wf-preview-table thead');
    var tbody = document.querySelector('#wf-preview-table tbody');
    var list = document.getElementById('wf-mapping-list');
    if (!meta) return;

    var regions = {};
    state.rawRows.forEach(function (r) {
      var v = r.region || r.Region || r.area;
      if (v) regions[v] = 1;
    });

    meta.innerHTML =
      '<strong>' + (state.meta.name || 'مسودة') + '</strong>' +
      (state.meta.dataKind === 'demo' ? ' <span class="badge badge-warning">تجريبي</span>' : '') +
      '<br>سجلات: ' + state.rawRows.length +
      ' · أعمدة: ' + state.headers.length +
      ' · مناطق مكتشفة: ' + (Object.keys(regions).join(', ') || '—');

    thead.innerHTML = '<tr>' + state.headers.map(function (h) {
      return '<th>' + h + '</th>';
    }).join('') + '</tr>';
    tbody.innerHTML = state.rawRows.slice(0, 10).map(function (r) {
      return '<tr>' + state.headers.map(function (h) {
        return '<td>' + (r[h] != null ? r[h] : '') + '</td>';
      }).join('') + '</tr>';
    }).join('');

    list.innerHTML = state.headers.map(function (h) {
      var opts = STANDARD.map(function (s) {
        return '<option value="' + s.key + '"' + (state.mapping[h] === s.key ? ' selected' : '') + '>' + s.label + '</option>';
      }).join('');
      return '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:6px;">' +
        '<code style="min-width:120px;">' + h + '</code> → ' +
        '<select class="form-control" data-map-src="' + h.replace(/"/g, '') + '" style="width:auto;min-width:160px;">' + opts + '</select></div>';
    }).join('');

    list.querySelectorAll('[data-map-src]').forEach(function (sel) {
      sel.onchange = function () {
        state.mapping[sel.getAttribute('data-map-src')] = sel.value;
      };
    });

    goStep(2);
  }

  function runQuality() {
    applyMapping();
    var q = DataHub.qualityScan(state.mappedRows);
    var rows = state.mappedRows;
    var rain = rows.filter(function (r) { return r.rainfall_mm != null; }).length;
    var water = rows.filter(function (r) { return r.demand_m3 != null && r.supply_m3 != null; }).length;
    var health = rows.filter(function (r) { return r.health_index != null; }).length;
    var regions = {};
    rows.forEach(function (r) { if (r.region) regions[r.region] = 1; });
    var regionN = Object.keys(regions).length;

    function spiStatus(need) {
      if (rain < need) return { s: 'غير متاح', reason: 'يحتاج ≥' + need + ' قراءة مطر (متوفر ' + rain + ')' };
      if (regionN > 1) return { s: 'يحتاج مراجعة', reason: 'عدة مناطق — افصل قبل SPI موثوق' };
      if (rain < 24) return { s: 'متاح بقيود', reason: 'سلسلة قصيرة للمعايرة (يفضّل ≥24 شهراً، مثالياً ~30 سنة)' };
      return { s: 'متاح', reason: 'هطول شهري كافٍ تقريباً' };
    }

    var engines = {
      'SPI-1': spiStatus(6),
      'SPI-3': spiStatus(12),
      'SPI-6': spiStatus(18),
      'SPI-12': spiStatus(24),
      'شح المياه': water >= 3 ? { s: 'متاح', reason: 'عرض وطلب' } : { s: 'غير متاح', reason: 'يلزم demand_m3 و supply_m3' },
      'الهشاشة الصحية': health >= 3 ? { s: 'متاح', reason: 'health_index' } : { s: 'غير متاح', reason: 'يلزم health_index' },
      'المؤشر المركّب': rain >= 6 ? { s: (water >= 3 && health >= 3) ? 'متاح' : 'متاح جزئياً', reason: 'حسب توفر المؤشرات الفرعية' } : { s: 'غير متاح', reason: 'مدخلات ناقصة' }
    };

    state.quality = { scan: q, engines: engines };

    var panel = document.getElementById('wf-quality-panel');
    if (!panel) return;
    var html = '<p><strong>السجلات بعد المطابقة:</strong> ' + rows.length +
      (q.issues.length ? ' · تحذيرات: ' + q.issues.length : ' · لا تحذيرات حرجة') + '</p>';
    if (q.issues.length) {
      html += '<ul style="font-size:0.85rem;">' + q.issues.map(function (i) {
        return '<li>' + i.msg + '</li>';
      }).join('') + '</ul>';
    }
    html += '<table style="width:100%;font-size:0.9rem;margin-top:10px;"><thead><tr><th>التحليل</th><th>الحالة</th><th>السبب</th></tr></thead><tbody>';
    Object.keys(engines).forEach(function (k) {
      var e = engines[k];
      html += '<tr><td>' + k + '</td><td>' + e.s + '</td><td>' + e.reason + '</td></tr>';
    });
    html += '</tbody></table>';
    html += '<p style="font-size:0.8rem;color:var(--text-secondary);margin-top:10px;">عدم توفر مؤشر واحد لا يمنع اعتماد المجموعة للتحليلات الأخرى.</p>';
    panel.innerHTML = html;
    goStep(3);
  }

  function showActivate() {
    var sum = document.getElementById('wf-activate-summary');
    var nameEl = document.getElementById('wf-ds-name');
    var srcEl = document.getElementById('wf-ds-source');
    if (nameEl && !nameEl.value) nameEl.value = state.meta.name || ('مجموعة ' + new Date().toLocaleDateString('ar'));
    if (srcEl && !srcEl.value) srcEl.value = state.meta.source || '';
    if (sum) {
      var eng = state.quality && state.quality.engines || {};
      var avail = Object.keys(eng).filter(function (k) { return eng[k].s.indexOf('متاح') === 0; });
      sum.innerHTML =
        '<p>النوع: <strong>' + (state.meta.dataKind === 'demo' ? 'تجريبي' : 'فعلي') + '</strong></p>' +
        '<p>سجلات: <strong>' + state.mappedRows.length + '</strong></p>' +
        '<p>تحليلات متاحة/جزئية: ' + (avail.join(' · ') || '—') + '</p>';
    }
    goStep(4);
  }

  function beginFromRows(headers, rows, meta) {
    state.headers = headers;
    state.rawRows = rows;
    state.meta = Object.assign({ name: '', source: '', dataKind: 'actual' }, meta || {});
    state.mapping = autoMap(headers);
    showPreview();
  }

  function beginFromNormalized(rows, meta) {
    // already standard fields
    var headers = DataHub.STANDARD_FIELDS.filter(function (f) {
      return rows.some(function (r) { return r[f] != null; });
    });
    if (!headers.length) headers = DataHub.STANDARD_FIELDS.slice(0, 6);
    var raw = rows.map(function (r) {
      var o = {};
      headers.forEach(function (h) { o[h] = r[h]; });
      return o;
    });
    beginFromRows(headers, raw, meta);
  }

  function activateAndGo() {
    applyMapping();
    if (!state.mappedRows.length) {
      toast('لا سجلات بعد المطابقة', 'warning');
      return;
    }
    var name = (document.getElementById('wf-ds-name') || {}).value || state.meta.name || 'مجموعة';
    var ds = DataHub.createFromRows({
      name: name,
      source: (document.getElementById('wf-ds-source') || {}).value || state.meta.source || '',
      country: (document.getElementById('wf-ds-country') || {}).value || '',
      license: (document.getElementById('wf-ds-license') || {}).value || '',
      notes: (document.getElementById('wf-ds-notes') || {}).value || '',
      dataKind: state.meta.dataKind || 'actual',
      type: 'climate',
      status: 'ready',
      qualityReport: state.quality
    }, state.mappedRows);

    var act = DataHub.activateForAnalysis(ds.id);
    if (!act.ok) {
      toast(act.error, 'warning');
      return;
    }
    toast('تم اعتماد «' + ds.name + '» — الانتقال إلى المخاطر');
    setTimeout(function () {
      location.href = 'risk.html';
    }, 600);
  }

  function fillSavedSelect() {
    var sel = document.getElementById('saved-datasets-select');
    if (!sel) return;
    var list = DataHub.loadAll();
    sel.innerHTML = '<option value="">— اختر —</option>' + list.map(function (d) {
      return '<option value="' + d.id + '">' + d.name + ' (' + (d.recordCount || 0) + ') ' +
        (d.dataKind === 'demo' ? '[تجريبي]' : '') + '</option>';
    }).join('');
  }

  function bindWorkflow() {
    fillSavedSelect();
    var ban = document.getElementById('data-storage-banner');
    if (ban) ban.innerHTML = '<strong>التخزين:</strong> محلي على هذا الجهاز/المتصفح. المجموعات لا تُرفع لخادم إلا عند تفعيل Backend.';

    // upload uses DataHub.importFiles then opens wizard from last result — intercept
    var input = document.getElementById('file-input');
    if (input) {
      input.addEventListener('change', function () {
        if (!input.files || !input.files.length) return;
        var info = document.getElementById('upload-file-info');
        var f = input.files[0];
        if (info) info.textContent = f.name + ' · ' + Math.round(f.size / 1024) + ' ك.ب · ' + (f.type || 'ملف');
        toast('جاري قراءة الملف…');
        DataHub.importFiles(input.files).then(function (res) {
          input.value = '';
          var ok = (res.results || []).filter(function (r) { return r.ok; })[0];
          if (!ok) {
            toast((res.results && res.results[0] && res.results[0].error) || 'فشل الاستيراد', 'warning');
            return;
          }
          var ds = ok.dataset;
          beginFromNormalized(ds.rows, { name: ds.name, source: ds.source, dataKind: 'actual' });
          // remove auto-saved until user confirms activate? keep draft in hub is ok
          fillSavedSelect();
        });
      });
    }

    document.getElementById('btn-open-manual') && (document.getElementById('btn-open-manual').onclick = function () {
      var p = document.getElementById('manual-entry-panel');
      if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('btn-demo-data') && (document.getElementById('btn-demo-data').onclick = function () {
      if (!confirm('تحميل بيانات تجريبية اصطناعية؟ لن تُعرض كبيانات فعلية.')) return;
      var ds = DataHub.loadOrRefreshDemo();
      beginFromNormalized(ds.rows, { name: ds.name, source: ds.source, dataKind: 'demo' });
      fillSavedSelect();
    });

    document.getElementById('btn-load-saved') && (document.getElementById('btn-load-saved').onclick = function () {
      var id = (document.getElementById('saved-datasets-select') || {}).value;
      if (!id) { toast('اختر مجموعة', 'warning'); return; }
      var ds = DataHub.getById(id);
      if (!ds || !ds.rows || !ds.rows.length) { toast('لا قراءات في هذه المجموعة', 'warning'); return; }
      beginFromNormalized(ds.rows, { name: ds.name, source: ds.source, dataKind: ds.dataKind || 'actual' });
      state.draftId = ds.id;
    });

    document.getElementById('btn-manual-to-preview') && (document.getElementById('btn-manual-to-preview').onclick = function () {
      var body = document.getElementById('manual-readings-body');
      var rows = [];
      if (body) body.querySelectorAll('tr').forEach(function (tr) {
        var obj = {};
        tr.querySelectorAll('[data-f]').forEach(function (inp) { obj[inp.getAttribute('data-f')] = inp.value; });
        var n = DataHub.normalizeRow(obj);
        if (n) rows.push(n);
      });
      if (!rows.length) { toast('أدخل صفاً صالحاً على الأقل', 'warning'); return; }
      beginFromNormalized(rows, { name: 'إدخال يدوي', source: 'يدوي', dataKind: 'actual' });
    });

    document.getElementById('btn-parse-paste') && (document.getElementById('btn-parse-paste').onclick = function () {
      var text = (document.getElementById('paste-excel-area') || {}).value || '';
      var parsed = DataHub.parseDelimited(text);
      if (!parsed.ok || !parsed.rows.length) { toast(parsed.error || 'لا صفوف', 'warning'); return; }
      // show raw headers for mapping
      var raw = [];
      var lines = text.trim().split(/\r?\n/);
      var delim = lines[0].indexOf('\t') >= 0 ? '\t' : ',';
      var headers = lines[0].split(delim).map(function (h) { return h.trim().replace(/^"|"$/g, ''); });
      for (var i = 1; i < lines.length; i++) {
        var cells = lines[i].split(delim);
        var o = {};
        headers.forEach(function (h, j) { o[h] = (cells[j] || '').trim().replace(/^"|"$/g, ''); });
        raw.push(o);
      }
      beginFromRows(headers, raw, { name: 'لصق Excel', source: 'لصق', dataKind: 'actual' });
    });

    document.getElementById('btn-wf-confirm-map') && (document.getElementById('btn-wf-confirm-map').onclick = function () {
      var hasRain = Object.keys(state.mapping).some(function (h) { return state.mapping[h] === 'rainfall_mm'; });
      var hasDate = Object.keys(state.mapping).some(function (h) { return state.mapping[h] === 'date'; });
      applyMapping();
      if (!state.mappedRows.length) {
        toast('لم ينتج أي سجل من المطابقة — راجع الأعمدة', 'warning');
        return;
      }
      if (!hasDate && !state.mappedRows.some(function (r) { return r.date; })) {
        toast('تحذير: لا يوجد حقل تاريخ مطابق', 'warning');
      }
      runQuality();
    });

    document.getElementById('btn-wf-to-activate') && (document.getElementById('btn-wf-to-activate').onclick = showActivate);
    document.getElementById('btn-wf-activate') && (document.getElementById('btn-wf-activate').onclick = activateAndGo);
    document.getElementById('btn-wf-back-1') && (document.getElementById('btn-wf-back-1').onclick = function () { goStep(1); });
    document.getElementById('btn-wf-back-2') && (document.getElementById('btn-wf-back-2').onclick = function () { goStep(2); });
    document.getElementById('btn-wf-back-3') && (document.getElementById('btn-wf-back-3').onclick = function () { goStep(3); });

    document.querySelectorAll('[data-step-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var n = Number(btn.getAttribute('data-step-btn'));
        if (n <= state.step || !btn.disabled) goStep(n);
      });
    });
  }

  var _bind = DataHub.bindUI;
  DataHub.bindUI = function () {
    if (_bind) _bind();
    bindWorkflow();
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (document.body && document.body.dataset.page === 'data') {
      bindWorkflow();
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
