/* ========================================
   ماء ريسك - Page-specific Interactivity
   ======================================== */

function downloadTextFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 400);
}

window.PageModules = {
  __guest_wrap: true,
  _guard() {
    if (typeof requireLoginForAction === 'function' && !requireLoginForAction('هذه الوحدة')) return false;
    if (window.__MAARISK_GUEST_BLOCKED__) return false;
    return true;
  },


  /* ---------- DATA PAGE ---------- */
  data() {
    if (this._guard && !this._guard()) return;
    // إدارة البيانات بالكامل عبر DataHub (مصدر موحّد)
    if (typeof DataHub !== 'undefined' && DataHub.bindUI) {
      try { DataHub.bindUI(); } catch (e) { console.warn(e); }
    }
  },

  /* ---------- RISK PAGE ---------- */
  risk() {
    if (this._guard && !this._guard()) return;
    // التحليل الفعلي: analysis-engine.js + SPI gauge + composite — لا نتائج وهمية هنا
    const results = document.getElementById('risk-results');
    if (results) results.classList.add('visible');
    document.querySelectorAll('#risk-controls select').forEach(sel => {
      sel.addEventListener('change', () => {
        showToast(currentLang === 'ar' ? 'تم تحديث الإعدادات — أعد تشغيل التحليل' : 'Settings updated — re-run analysis');
      });
    });
  },

  /* ---------- MAPS PAGE ---------- */
  maps() {
    if (this._guard && !this._guard()) return;
    const state = getState();
    const checkboxes = document.querySelectorAll('[data-layer]');
    const mapOverlay = document.getElementById('map-overlay-text');
    const statusEl = document.getElementById('map-tile-status');

    const countryLabel = 'الأردن';
    const regionLabel = 'جنوب الأردن — محافظة معان (مناطق الأولوية)';
    const zones = [
      { name: 'القويرة', lat: 29.735, lng: 35.312, score: 0.86, pop: 4200, groups: 'رعاة + أسر ريفية', water: 0.88, drought: 0.86, health: 0.72, density: 18, access: 54 },
      { name: 'وادي رم', lat: 29.577, lng: 35.420, score: 0.81, pop: 1800, groups: 'مجتمعات محلية', water: 0.80, drought: 0.84, health: 0.65, density: 6, access: 48 },
      { name: 'المدورة', lat: 29.310, lng: 35.990, score: 0.77, pop: 2500, groups: 'مزارعون صغار', water: 0.76, drought: 0.78, health: 0.70, density: 12, access: 51 },
      { name: 'حسينية / الحسينية', lat: 30.255, lng: 35.720, score: 0.72, pop: 5100, groups: 'أسر منخفضة الدخل', water: 0.70, drought: 0.68, health: 0.74, density: 28, access: 62 },
      { name: 'معان المدينة (أطراف)', lat: 30.192, lng: 35.746, score: 0.68, pop: 8000, groups: 'أحياء هامشية', water: 0.64, drought: 0.62, health: 0.60, density: 95, access: 71 }
    ];
    // محطات رصد تجريبية معلّمة
    // إحداثيات تقريبية موثوقة لمواقع معروفة في جنوب الأردن
    const stations = [
      { name: 'محطة معان المناخية', lat: 30.196, lng: 35.734, type: 'مناخ' },
      { name: 'محطة القويرة', lat: 29.736, lng: 35.305, type: 'هطول' },
      { name: 'محطة وادي رم', lat: 29.575, lng: 35.420, type: 'جفاف' },
      { name: 'محطة العقبة المرجعية', lat: 29.532, lng: 35.006, type: 'مناخ ساحلي' }
    ];
    // حدود الأردن التقريبية للعرض الابتدائي
    const jordanBounds = L.latLngBounds([29.18, 34.88], [33.38, 39.30]);

    const mapEl = document.getElementById('risk-map');
    if (!mapEl) return;

    if (typeof L === 'undefined') {
      mapEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary)">مكتبة Leaflet غير محمّلة. تحقق من الاتصال.</div>';
      return;
    }

    // تنظيف خريطة سابقة إن وُجدت
    if (window.__riskMap) {
      try { window.__riskMap.remove(); } catch (e) {}
      window.__riskMap = null;
    }
    mapEl.innerHTML = '';

    const map = L.map(mapEl, { scrollWheelZoom: true, zoomControl: true }).setView([29.85, 35.55], 8);

    // —— مصادر البلاط (بدون tile.openstreetmap.org لتجنب 403 وفق سياسة الاستخدام) ——
    function makeTile(url, opts) {
      const layer = L.tileLayer(url, Object.assign({
        maxZoom: 18,
        crossOrigin: true
      }, opts || {}));
      let errCount = 0;
      layer.on('tileerror', () => {
        errCount++;
        if (statusEl && errCount <= 3) {
          statusEl.textContent = 'تعذر تحميل بعض بلاطات المصدر الحالي — جرّب مصدراً آخر من القائمة.';
          statusEl.style.color = 'var(--warning)';
        }
      });
      // لا نعلن النجاح هنا — يُعلن بعد tileload الفعلي
      return layer;
    }

    // مصادر بلاط بدون مفتاح API (تم التحقق HTTP 200)
    // ملاحظة: CARTO Voyager يعرض أحياناً صورة "API KEY REQUIRED" بحجم صغير رغم 200
    const basemaps = {
      streets: makeTile('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri — World Street Map',
        maxZoom: 18
      }),
      satellite: makeTile('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri — World Imagery',
        maxZoom: 17
      }),
      topo: makeTile('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri — World Topo Map',
        maxZoom: 18
      }),
      // OSM France كمصدر موضوعي/شوارع بديل يظهر أسماء عربية/لاتينية
      risk: makeTile('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors, OSM France',
        maxZoom: 18,
        subdomains: 'abc'
      })
    };
    const streetsFallback = makeTile('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors, openstreetmap.de',
      maxZoom: 18
    });
    const topoFallback = makeTile('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap, SRTM | OpenTopoMap',
      maxZoom: 17,
      subdomains: 'abc'
    });

    let activeBase = basemaps.streets;
    activeBase.addTo(map);

    // نجاح التحميل = بلاطات فعلية (tileload) وليس مجرد تهيئة الخريطة
    let tilesLoaded = 0;
    let baseFailed = false;
    function onBaseTileLoad() {
      tilesLoaded++;
      if (tilesLoaded >= 2 && statusEl) {
        statusEl.textContent = 'تم تحميل خريطة الأساس بنجاح (بلاطات جغرافية).';
        statusEl.style.color = 'var(--success)';
      }
    }
    function attachLoadWatch(layer) {
      tilesLoaded = 0;
      layer.on('tileload', onBaseTileLoad);
      layer.on('tileerror', () => {
        baseFailed = true;
        if (statusEl) {
          statusEl.textContent = 'فشل بلاط من المصدر الحالي — جاري تجربة البديل…';
          statusEl.style.color = 'var(--warning)';
        }
      });
    }
    attachLoadWatch(activeBase);

    setTimeout(() => {
      if (tilesLoaded < 1) {
        map.removeLayer(activeBase);
        activeBase = streetsFallback;
        activeBase.addTo(map);
        attachLoadWatch(activeBase);
        if (statusEl) {
          statusEl.textContent = 'تم التبديل إلى مصدر بديل (OSM Deutschland).';
          statusEl.style.color = 'var(--warning)';
        }
      }
    }, 5000);

    // طبقات تحليلية
    const layerGroups = {
      water: L.layerGroup(),
      drought: L.layerGroup(),
      health: L.layerGroup(),
      density: L.layerGroup(),
      access: L.layerGroup(),
      stations: L.layerGroup()
    };

    function scoreColor(s) {
      if (s >= 0.8) return '#C23B22';
      if (s >= 0.7) return '#E07A3D';
      if (s >= 0.55) return '#C4A574';
      return '#2A9D8F';
    }

    zones.forEach(z => {
      // جفاف — دوائر متوسطة الشفافية
      const droughtR = 6000 + z.drought * 9000;
      L.circle([z.lat, z.lng], {
        radius: droughtR,
        color: scoreColor(z.drought),
        fillColor: scoreColor(z.drought),
        fillOpacity: 0.22,
        weight: 1.5,
        opacity: 0.75
      }).bindPopup(
        `<strong>${z.name}</strong><br>الدولة: ${countryLabel}<br>جفاف: ${z.drought}<br>هشاشة مركّبة: ${z.score}<br>سكان ≈ ${z.pop}<br>${z.groups}`
      ).addTo(layerGroups.drought);

      // شح مياه — حلقة أضيق
      L.circle([z.lat, z.lng], {
        radius: 4500 + z.water * 6000,
        color: '#0E7C7B',
        fillColor: '#14B8A6',
        fillOpacity: 0.15,
        weight: 1,
        dashArray: '4 4'
      }).bindPopup(`${z.name}<br>شح مياه: ${z.water}`).addTo(layerGroups.water);

      // هشاشة صحية — علامات
      L.circleMarker([z.lat + 0.02, z.lng + 0.02], {
        radius: 7,
        color: '#7C3AED',
        fillColor: '#A78BFA',
        fillOpacity: 0.85,
        weight: 1
      }).bindPopup(`${z.name}<br>هشاشة صحية: ${z.health}`).addTo(layerGroups.health);

      // كثافة سكانية
      L.circle([z.lat, z.lng], {
        radius: 2000 + Math.min(z.density, 120) * 40,
        color: '#3A7CA5',
        fillColor: '#3A7CA5',
        fillOpacity: 0.12,
        weight: 1
      }).bindPopup(`${z.name}<br>كثافة تقريبية: ${z.density}`).addTo(layerGroups.density);

      // وصول للمياه (عكسياً: وصول أقل = دائرة أوضح)
      const accessRisk = (100 - z.access) / 100;
      L.circleMarker([z.lat - 0.015, z.lng - 0.015], {
        radius: 5 + accessRisk * 6,
        color: '#B45309',
        fillColor: '#F59E0B',
        fillOpacity: 0.8,
        weight: 1
      }).bindPopup(`${z.name}<br>الوصول لمصادر المياه: ${z.access}%`).addTo(layerGroups.access);
    });

    stations.forEach(st => {
      L.marker([st.lat, st.lng]).bindPopup(
        `<strong>${st.name}</strong><br>نوع: ${st.type}<br>إحداثيات: ${st.lat.toFixed(3)}, ${st.lng.toFixed(3)}`
      ).addTo(layerGroups.stations);
    });

    // إطار منطقة الأولوية
    const priorityBounds = L.latLngBounds(zones.map(z => [z.lat, z.lng]));
    L.rectangle(priorityBounds.pad(0.35), {
      color: '#0B3D4A',
      weight: 2,
      dashArray: '6 4',
      fillColor: '#0B3D4A',
      fillOpacity: 0.04
    }).addTo(map).bindPopup('<strong>' + regionLabel + '</strong>');

    const activeLayers = state.layers || { water: true, drought: true, health: true, density: false, access: false, stations: true };
    Object.keys(layerGroups).forEach(k => {
      if (activeLayers[k] !== false) layerGroups[k].addTo(map);
    });

    // عرض الأردن كاملاً أولاً
    map.fitBounds(jordanBounds.pad(0.05));
    // إبراز نطاق الأولوية بحدّ خفيف دون إجبار التكبير المفرط
    setTimeout(() => {
      try {
        const outer = jordanBounds.pad(0.02);
        map.setMaxBounds(outer.pad(0.4));
      } catch (e) {}
    }, 300);

    window.__riskMap = map;
    window.__riskLayers = layerGroups;
    window.__riskZones = zones;
    window.__riskBasemaps = basemaps;
    window.__riskActiveBase = () => activeBase;
    window.__riskSetBase = (key) => {
      if (!basemaps[key]) return;
      map.removeLayer(activeBase);
      activeBase = basemaps[key];
      // تضاريس: إن فشل Esri topo يمكن للمستخدم اختيار risk (OSM FR)
      activeBase.addTo(map);
      attachLoadWatch(activeBase);
      if (statusEl) {
        statusEl.textContent = 'جاري تحميل المصدر: ' + key + '…';
        statusEl.style.color = 'var(--text-secondary)';
      }
    };

    setTimeout(() => map.invalidateSize(), 250);
    setTimeout(() => map.invalidateSize(), 800);

    // مبدّل مصدر الأساس
    const basemapSelect = document.getElementById('basemap-select');
    if (basemapSelect) {
      basemapSelect.value = 'streets';
      basemapSelect.onchange = () => window.__riskSetBase(basemapSelect.value);
    }

    checkboxes.forEach(cb => {
      const key = cb.dataset.layer;
      cb.checked = activeLayers[key] !== false;
      cb.onchange = () => {
        const layers = { ...getState().layers, [key]: cb.checked };
        setState({ layers });
        const lg = window.__riskLayers && window.__riskLayers[key];
        if (lg && window.__riskMap) {
          if (cb.checked) window.__riskMap.addLayer(lg);
          else window.__riskMap.removeLayer(lg);
        }
        if (mapOverlay) {
          const active = Object.entries(layers).filter(([, v]) => v).map(([k]) => k);
          mapOverlay.textContent = regionLabel + (active.length ? ' · طبقات: ' + active.join(' · ') : '');
        }
      };
    });

    // طبقة المحطات افتراضياً إن وُجد checkbox
    const stCb = document.querySelector('[data-layer="stations"]');
    if (stCb) {
      stCb.checked = activeLayers.stations !== false;
    }

    if (mapOverlay) {
      mapOverlay.textContent = regionLabel + ' — بلاطات CARTO/Esri/OpenTopoMap (بدون خوادم OSM العامة المحظورة)';
    }

    document.querySelectorAll('[data-region]').forEach(row => {
      row.style.cursor = 'pointer';
      row.onclick = () => {
        document.querySelectorAll('[data-region]').forEach(r => r.classList.remove('selected-row'));
        row.classList.add('selected-row');
        const name = row.dataset.region;
        showToast((currentLang === 'ar' ? 'تم تحديد المنطقة: ' : 'Selected: ') + name);
        const z = zones.find(x => x.name === name || name.includes(x.name) || x.name.includes(name));
        if (z && window.__riskMap) window.__riskMap.setView([z.lat, z.lng], 11);
      };
    });
  },

  solutions() {
    if (this._guard && !this._guard()) return;
    const state = getState();
    const checkboxes = document.querySelectorAll('[data-solution]');
    const summaryEl = document.getElementById('solutions-summary');

    // Restore selection
    checkboxes.forEach(cb => {
      cb.checked = state.selectedSolutions.includes(cb.dataset.solution);
      cb.addEventListener('change', updateSelection);
    });

    function updateSelection() {
      const selected = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.dataset.solution);
      setState({ selectedSolutions: selected });
      renderSummary(selected);
    }

    function renderSummary(selected) {
      if (!summaryEl) return;
      if (!selected.length) {
        summaryEl.innerHTML = `<p style="color:var(--text-secondary)">${t('toast_select')}</p>`;
        return;
      }
      const items = SOLUTIONS_DATA.filter(s => selected.includes(s.id));
      const totalWater = items.reduce((a, s) => a + s.water, 0).toFixed(2);
      const totalCost = items.reduce((a, s) => a + s.cost, 0).toFixed(1);
      summaryEl.innerHTML = `
        <div class="grid-3" style="gap:12px;">
          <div class="stat-card"><div class="value">${selected.length}</div><div class="label">حلول مختارة</div></div>
          <div class="stat-card"><div class="value">${totalWater} م</div><div class="label">م³ مياه / سنة</div></div>
          <div class="stat-card"><div class="value">${totalCost} م$</div><div class="label">تكلفة تقريبية</div></div>
        </div>
      `;
    }

    renderSummary(state.selectedSolutions);

    // Sort buttons
    const table = document.getElementById('solutions-table');
    document.querySelectorAll('[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.sort;
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort((a, b) => {
          const va = parseFloat(a.dataset[key]) || 0;
          const vb = parseFloat(b.dataset[key]) || 0;
          return vb - va;
        });
        rows.forEach(r => tbody.appendChild(r));
        showToast(currentLang === 'ar' ? 'تم الترتيب' : 'Sorted');
      });
    });
  },

  /* ---------- COSTING PAGE ---------- */
  costing() {
    if (this._guard && !this._guard()) return;
    const state = getState();
    const selected = state.selectedSolutions || [];
    const items = SOLUTIONS_DATA.filter(s => selected.includes(s.id));
    const tbody = document.getElementById('costing-tbody');
    const totalCostEl = document.getElementById('total-cost');
    const totalMaintEl = document.getElementById('total-maint');
    const ratioEl = document.getElementById('cost-benefit-ratio');

    if (tbody) {
      if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-secondary)">لم يتم اختيار حلول بعد — ارجع لصفحة الحلول</td></tr>`;
      } else {
        tbody.innerHTML = items.map(s => `
          <tr>
            <td>${s.name}</td>
            <td>${s.cost} م$</td>
            <td>${s.maint} م$</td>
            <td>${s.benefit} م$ (مياه + منافع)</td>
            <td>≈ ${Math.ceil(s.cost / (s.benefit * 0.4))} سنوات</td>
            <td><span class="badge badge-success">عالية</span></td>
          </tr>
        `).join('');
      }
    }

    const totalCost = items.reduce((a, s) => a + s.cost, 0);
    const totalMaint = items.reduce((a, s) => a + s.maint, 0);
    const totalBenefit = items.reduce((a, s) => a + s.benefit, 0);
    const ratio = totalCost ? (totalBenefit * 5 / totalCost).toFixed(1) : '—';

    if (totalCostEl) totalCostEl.textContent = totalCost ? totalCost.toFixed(1) + ' م$' : '—';
    if (totalMaintEl) totalMaintEl.textContent = totalMaint ? totalMaint.toFixed(2) + ' م$' : '—';
    if (ratioEl) ratioEl.textContent = ratio;

    // Funding gap
    const phase1 = document.getElementById('phase1-amount');
    const gap = document.getElementById('funding-gap');
    if (phase1) phase1.value = totalCost ? (totalCost * 0.65).toFixed(1) + ' مليون دولار' : '—';
    if (gap) gap.value = totalCost ? (totalCost * 0.35).toFixed(1) + ' مليون دولار' : '—';

    // Generate proposal
    const propBtn = document.getElementById('btn-proposal');
    if (propBtn) {
      propBtn.addEventListener('click', () => {
        if (!items.length) {
          showToast(t('toast_select'), 'warning');
          return;
        }
        propBtn.disabled = true;
        propBtn.innerHTML = '<span class="spinner"></span> جاري الإنشاء...';
        setTimeout(() => {
          propBtn.disabled = false;
          propBtn.innerHTML = '✓ تم إنشاء المسودة';
          showToast(currentLang === 'ar' ? 'تم إنشاء مسودة المقترح الاستثماري' : 'Investment proposal draft created');
          const box = document.getElementById('proposal-preview');
          if (box) {
            box.innerHTML = `
              <h4 style="margin-bottom:8px;">مسودة مقترح استثماري</h4>
              <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.6;">
                الحلول المختارة (${items.length}): ${items.map(s => s.name).join('، ')}.<br>
                التكلفة الإجمالية: ${totalCost.toFixed(1)} م$ · المنافع السنوية التقديرية: ${totalBenefit.toFixed(1)} م$.<br>
                المناطق ذات الأولوية مرتبطة بتحليل المخاطر والخرائط السابقة.
              </p>
            `;
          }
        }, 1500);
      });
    }
  },

  /* ---------- REPORTS PAGE ---------- */
  reports() {
    if (this._guard && !this._guard()) return;
    const state = getState();
    const preview = document.getElementById('report-preview');
    const audienceSel = document.getElementById('report-audience');
    const langSel = document.getElementById('report-lang');
    const detailSel = document.getElementById('report-detail');

    // Restore settings
    if (audienceSel && state.reportSettings) {
      audienceSel.value = state.reportSettings.audience || 'funders';
      if (langSel) langSel.value = state.reportSettings.lang || 'ar';
      if (detailSel) detailSel.value = state.reportSettings.detail || 'standard';
    }

    function buildPreview() {
      const audience = audienceSel ? audienceSel.value : 'funders';
      const lang = langSel ? langSel.value : 'ar';
      const detail = detailSel ? detailSel.value : 'standard';
      setState({ reportSettings: { audience, lang, detail } });

      const st = getState();
      const sols = (st.selectedSolutions || []).map(id => {
        const s = SOLUTIONS_DATA.find(x => x.id === id);
        return s ? s.name : id;
      }).join('، ') || '—';

      const audienceLabel = {
        planners: 'المخططون والوزارات',
        municipalities: 'البلديات والهيئات المحلية',
        funders: 'الجهات الممولة',
        full: 'تقرير فني شامل'
      };

      if (!preview) return;
      preview.innerHTML = `
        <h3 style="margin-bottom:8px;font-size:1.15rem;">تقرير تقييم مخاطر شح المياه والجفاف</h3>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:16px;">
          موجه إلى: ${audienceLabel[audience] || audience} · اللغة: ${lang === 'ar' ? 'العربية' : lang === 'en' ? 'English' : 'Français'} · ${new Date().toLocaleDateString('ar')}
        </p>
        <hr style="border:none;border-top:1px solid var(--border);margin:16px 0;">
        <h4 style="font-size:0.95rem;margin-bottom:8px;">1. الملخص التنفيذي</h4>
        <p style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;margin-bottom:12px;">
          ${st.analysisDone
            ? 'تشير التحليلات إلى مستوى خطر مرتفع لشح المياه في أربع مناطق ذات أولوية، مع توقعات بزيادة تتراوح بين 18–31% بحلول 2030–2040 تحت السيناريو المتوسط.'
            : 'لم يُشغَّل تحليل المخاطر بعد. يُفضّل إكمال وحدة المخاطر أولاً.'}
        </p>
        <h4 style="font-size:0.95rem;margin-bottom:8px;">2. المناطق والمجتمعات الهشة</h4>
        <p style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;margin-bottom:12px;">
          حوالي 12,400 نسمة يعيشون في مناطق عالية الهشاشة (وادي السرحان، سهل القاع، تجمعات غرب الحوض).
        </p>
        <h4 style="font-size:0.95rem;margin-bottom:8px;">3. الحلول ذات الأولوية</h4>
        <p style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;margin-bottom:12px;">
          ${sols}
        </p>
        ${detail !== 'summary' ? `
        <h4 style="font-size:0.95rem;margin-bottom:8px;">4. التكاليف والتمويل</h4>
        <p style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;">
          تم تقدير التكاليف بناءً على الحلول المختارة. راجع وحدة التكاليف للتفاصيل الكاملة.
        </p>` : ''}
      `;
    }

    [audienceSel, langSel, detailSel].forEach(el => {
      if (el) el.addEventListener('change', buildPreview);
    });

    buildPreview();

    function doGenerate(btn) {
      btn.disabled = true;
      const original = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> جاري الإصدار...';
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = original;
        buildPreview();
        showToast(t('toast_report'));
        const text = preview ? preview.innerText : 'تقرير ماء ريسك';
        downloadTextFile('maarisk-report-' + Date.now() + '.txt', text);
        try {
          if (typeof DataStore !== 'undefined' && typeof currentActor === 'function') {
            const a = currentActor();
            if (a) DataStore.saveUserReport(a.id, { title: 'تقرير خاص', content: text, scope: 'private' });
          }
        } catch (e) { console.warn(e); }
      }, 1600);
    }

    document.querySelectorAll('.js-generate-report').forEach(btn => {
      // المستخدم: تقرير خاص | المدير: تقرير منصة + خاص
      if (typeof hasPermission === 'function' && !hasPermission(PERM.OWN_REPORTS) && !hasPermission(PERM.SYSTEM_LOGS_REPORTS)) {
        btn.addEventListener('click', e => {
          e.preventDefault();
          showToast(currentLang === 'ar' ? 'لا صلاحية لإصدار التقارير' : 'No report permission', 'warning');
        });
        return;
      }
      btn.addEventListener('click', () => doGenerate(btn));
    });

    // Export buttons
    document.querySelectorAll('[data-export]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof isAdmin === 'function' && !isAdmin()) {
          showToast(currentLang === 'ar' ? 'التصدير متاح للمدير فقط' : 'Export is admin-only', 'warning');
          return;
        }
        const format = btn.dataset.export;
        const text = preview ? preview.innerText : 'تقرير ماء ريسك';
        const stamp = Date.now();
        if (format === 'pdf' || format === 'word') {
          downloadTextFile('maarisk-report-' + stamp + (format === 'word' ? '.doc' : '.txt'), text,
            format === 'word' ? 'application/msword' : 'text/plain;charset=utf-8');
          showToast(t('toast_report'));
        } else if (format === 'link') {
          try {
            const key = 'maarisk_share_' + stamp;
            localStorage.setItem(key, text);
            const fake = location.origin + location.pathname + '#share=' + stamp;
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(fake);
              showToast(currentLang === 'ar' ? 'تم نسخ رابط المشاركة التجريبي' : 'Demo share link copied');
            } else {
              showToast(fake);
            }
          } catch (e) {
            showToast(currentLang === 'ar' ? 'تعذر إنشاء الرابط' : 'Could not create link', 'warning');
          }
        }
      });
    });
  }
};
