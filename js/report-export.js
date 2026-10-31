/**
 * تصدير تقارير PDF (طباعة/حفظ) وDOCX (Word XML بسيط) من محتوى فعلي
 */
(function (global) {
  'use strict';

  function collectReportHtml() {
    const preview = document.getElementById('report-preview') || document.querySelector('.report-preview');
    const analysis = (typeof AnalysisEngine !== 'undefined' && AnalysisEngine.loadStoredAnalysis)
      ? AnalysisEngine.loadStoredAnalysis() : window.__lastAnalysisResult;
    const composite = window.__lastComposite;
    let body = '';
    if (preview && preview.innerText.trim()) {
      body += '<section><h2>معاينة التقرير</h2>' + preview.innerHTML + '</section>';
    }
    if (analysis) {
      body += '<section><h2>نتائج التحليل</h2>';
      body += '<p>مصدر: ' + (analysis.meta && analysis.meta.isDemo ? 'تجريبي (موسوم)' : 'مستخدم') + '</p>';
      if (analysis.drought) {
        body += '<p>SPI الأخير: ' + analysis.drought.latestSpi + ' (' + analysis.drought.classification + ')</p>';
        body += '<p>الطريقة: ' + (analysis.drought.method || '') + '</p>';
      }
      if (analysis.water) {
        body += '<p>متوسط العجز: ' + analysis.water.meanDeficit + '</p>';
      }
      body += '</section>';
    }
    if (composite && composite.indices) {
      body += '<section><h2>المؤشرات المركبة</h2><ul>';
      Object.keys(composite.indices).forEach(k => {
        const ix = composite.indices[k];
        body += '<li>' + (ix.name && ix.name.ar) + ': ' + ix.final_0_100 + ' — ' + (ix.classification && ix.classification.ar) + '</li>';
      });
      body += '</ul></section>';
    }
    if (!body) {
      body = '<p>لا توجد نتائج محفوظة بعد. شغّل التحليل واحفظ المعاينة أولاً.</p>';
    }
    return body;
  }

  function exportPdf() {
    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير Mā’ Risk</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#111} h1,h2{color:#0B3D4A} table{border-collapse:collapse;width:100%} td,th{border:1px solid #ccc;padding:6px}</style>
      </head><body><h1>تقرير Mā’ Risk</h1><p>تاريخ التصدير: ${new Date().toLocaleString('ar')}</p>
      ${collectReportHtml()}
      <p style="margin-top:24px;font-size:12px;color:#666">مؤشرات تحليلية لدعم القرار — ليست تصنيفاً رسمياً.</p>
      <script>window.onload=function(){window.print()}<\/script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) {
      if (typeof showToast === 'function') showToast('اسمح بالنوافذ المنبثقة لتصدير PDF', 'warning');
      return false;
    }
    w.document.write(html);
    w.document.close();
    return true;
  }

  /** مستند Word متوافق عبر HTML mime */
  function exportDocx() {
    const content = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Mā’ Risk Report</title></head>
<body lang="ar" dir="rtl">
<h1>تقرير Mā’ Risk</h1>
<p>تاريخ: ${new Date().toISOString()}</p>
${collectReportHtml()}
</body></html>`;
    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'maarisk-report-' + Date.now() + '.doc';
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  }

  function exportProposalDraft() {
    const analysis = window.__lastAnalysisResult || (typeof AnalysisEngine !== 'undefined' && AnalysisEngine.loadStoredAnalysis && AnalysisEngine.loadStoredAnalysis());
    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>مسودة مقترح استثماري</title></head><body>
      <h1>مسودة مقترح استثماري — SHARE-EbA / Mā’ Risk</h1>
      <h2>1. الملخص</h2>
      <p>مقترح أولي مبني على مخرجات المنصة${analysis ? '' : ' (لم يُشغَّل تحليل بعد — أكمل التحليل قبل الاعتماد)'}.</p>
      <h2>2. المخاطر</h2>
      ${analysis && analysis.drought ? '<p>SPI: ' + analysis.drought.latestSpi + '</p>' : '<p>بانتظار التحليل</p>'}
      <h2>3. حلول EbA المقترحة</h2>
      <p>حصاد مياه، استعادة أودية، تأهيل مراعي، زراعة حرجية، كفاءة ري — تُحدَّد حسب اختيار المستخدم في وحدة الحلول.</p>
      <h2>4. التكاليف</h2>
      <p>تُستكمل من وحدة التكاليف (CapEx / OpEx).</p>
      <h2>5. الخطوات التالية</h2>
      <ul><li>معايرة محلية للأوزان</li><li>تحقق ميداني</li><li>إعداد ميزانية تفصيلية</li></ul>
    </body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'maarisk-proposal-draft-' + Date.now() + '.doc';
    a.click();
    return true;
  }

  function bind() {
    document.querySelectorAll('[data-export="pdf"]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        exportPdf();
        if (typeof showToast === 'function') showToast('افتح حوار الطباعة واختر حفظ كـ PDF');
      };
    });
    document.querySelectorAll('[data-export="word"], [data-export="docx"]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        exportDocx();
        if (typeof showToast === 'function') showToast('تم تنزيل ملف Word');
      };
    });
    document.querySelectorAll('[data-export="link"]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        if (typeof showToast === 'function') {
          showToast('المشاركة بروابط عامة غير مفعّلة بدون خادم مشاركة آمن — استخدم التصدير بدلاً منها', 'warning');
        }
      };
    });
    const prop = document.getElementById('btn-proposal-draft') || document.querySelector('[data-action="proposal"]');
    if (prop) {
      prop.onclick = (e) => {
        e.preventDefault();
        exportProposalDraft();
        if (typeof showToast === 'function') showToast('تم تنزيل مسودة المقترح');
      };
    }
  }

  global.ReportExport = { exportPdf, exportDocx, exportProposalDraft, collectReportHtml, bind };
  document.addEventListener('DOMContentLoaded', bind);
})(typeof window !== 'undefined' ? window : globalThis);
