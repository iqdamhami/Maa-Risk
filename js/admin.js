/* ========================================
   ماء ريسك - Admin Panel Logic
   ======================================== */

const MSG_KEY = 'maarisk_messages';
const FILES_KEY = 'maarisk_admin_files';
const ADMIN_REPORTS_KEY = 'maarisk_admin_reports';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getMessages() {
  try { return JSON.parse(localStorage.getItem(MSG_KEY) || '[]'); } catch { return []; }
}
function saveMessages(list) {
  localStorage.setItem(MSG_KEY, JSON.stringify(list));
}

function getAdminFiles() {
  try { return JSON.parse(localStorage.getItem(FILES_KEY) || '[]'); } catch { return []; }
}
function saveAdminFiles(list) {
  localStorage.setItem(FILES_KEY, JSON.stringify(list));
}

function getAdminReports() {
  try { return JSON.parse(localStorage.getItem(ADMIN_REPORTS_KEY) || '[]'); } catch { return []; }
}
function saveAdminReports(list) {
  localStorage.setItem(ADMIN_REPORTS_KEY, JSON.stringify(list));
}

function requireAdmin() {
  const session = getSession();
  if (!session || session.role !== 'admin') {
    alert('هذه الصفحة للمدير فقط. سيتم توجيهك لتسجيل الدخول.');
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

function downloadTextFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function buildPlatformReport(audience, language) {
  const st = (typeof getState === 'function') ? getState() : {};
  const users = getUsers().filter(u => u.role !== 'admin');
  const files = getAdminFiles();
  const lines = [
    '========================================',
    '  تقرير منصة ماء ريسك | Mā’ Risk',
    '========================================',
    'التاريخ: ' + new Date().toLocaleString('ar'),
    'الجمهور: ' + audience,
    'اللغة: ' + language,
    '',
    '--- ملخص النظام ---',
    'عدد المستخدمين النشطين: ' + users.filter(u => u.active !== false).length,
    'عدد المستخدمين الملغاة اشتراكاتهم: ' + users.filter(u => u.active === false).length,
    'ملفات البيانات المرفوعة (إدارة): ' + files.length,
    'تحليل مخاطر مكتمل: ' + (st.analysisDone ? 'نعم' : 'لا'),
    'حلول مختارة: ' + ((st.selectedSolutions || []).join(', ') || '—'),
    '',
    '--- المستخدمون ---'
  ];
  users.forEach(u => {
    lines.push(`- ${u.name} <${u.email}> [${u.active === false ? 'ملغى' : 'نشط'}]`);
  });
  lines.push('', '--- الملفات ---');
  files.forEach(f => {
    lines.push(`- ${f.name} (${f.type || 'file'}, ${Math.round((f.size || 0) / 1024)} KB)`);
  });
  lines.push('', '--- توصيات ---', 'مراجعة المناطق عالية الخطورة وإصدار مقترح تمويل للمرحلة الأولى.', '', 'نهاية التقرير');
  return lines.join('\n');
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page !== 'admin' && page !== 'messages') return;

  if (page === 'admin') {
    const session = requireAdmin();
    if (!session) return;
    initAdminTabs();
    initMessaging(session);
    initFileUpload(session);
    initAdminReports(session);
    initPasswordChange(session);
    initUserManagement(session);
  }

  if (page === 'messages') {
    const session = getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    initUserInbox(session);
  }
});

function initAdminTabs() {
  const tabs = document.querySelectorAll('[data-admin-tab]');
  const panels = document.querySelectorAll('[data-admin-panel]');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.adminTab;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      panels.forEach(p => {
        p.style.display = p.dataset.adminPanel === id ? '' : 'none';
      });
    });
  });
}

/* ---------- Messages (Admin) ---------- */
function initMessaging(session) {
  const userSelect = document.getElementById('msg-to');
  const form = document.getElementById('admin-msg-form');
  const listEl = document.getElementById('admin-msg-list');

  function fillUsers() {
    if (!userSelect) return;
    const users = getUsers().filter(u => u.role !== 'admin' && u.active !== false);
    userSelect.innerHTML = '<option value="all">الجميع</option>' +
      users.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)} — ${escapeHtml(u.email)}</option>`).join('');
  }

  function renderAdminMessages() {
    if (!listEl) return;
    const msgs = getMessages().slice().reverse();
    if (!msgs.length) {
      listEl.innerHTML = '<p style="color:var(--text-secondary)">لا توجد رسائل بعد.</p>';
      return;
    }
    const users = getUsers();
    listEl.innerHTML = msgs.map(m => {
      const toLabel = m.to === 'all' ? 'الجميع' : (users.find(u => u.id === m.to)?.name || m.to);
      const fromLabel = m.fromName || m.from;
      return `<div class="card" style="margin-bottom:12px;padding:16px;">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
          <strong>${escapeHtml(m.subject)}</strong>
          <span style="font-size:0.8rem;color:var(--text-secondary)">${new Date(m.createdAt).toLocaleString('ar')}</span>
        </div>
        <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">من: ${escapeHtml(fromLabel)} ← إلى: ${escapeHtml(toLabel)}</div>
        <div style="white-space:pre-wrap;font-size:0.95rem;">${escapeHtml(m.body)}</div>
      </div>`;
    }).join('');
  }

  fillUsers();
  renderAdminMessages();

  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const to = document.getElementById('msg-to').value;
      const subject = document.getElementById('msg-subject').value.trim();
      const body = document.getElementById('msg-body').value.trim();
      if (!subject || !body) {
        showToast('أكمل الموضوع ونص الرسالة', 'warning');
        return;
      }
      try {
        if (to === 'all') requirePermission(PERM.BROADCAST_MESSAGES);
        else requirePermission(PERM.BROADCAST_MESSAGES);
      } catch (err) {
        showToast(err.message, 'warning');
        return;
      }
      const msgs = getMessages();
      msgs.push({
        id: 'm_' + Date.now(),
        from: session.id,
        fromName: session.name,
        fromRole: 'admin',
        to,
        subject,
        body,
        createdAt: new Date().toISOString(),
        readBy: []
      });
      saveMessages(msgs);
      if (typeof auditLog === 'function') auditLog('admin_message', { to });
      form.reset();
      fillUsers();
      renderAdminMessages();
      showToast('تم إرسال الرسالة');
    });
  }
}

/* ---------- File upload (Admin) ---------- */
function initFileUpload(session) {
  const zone = document.getElementById('admin-upload-zone');
  const input = document.getElementById('admin-file-input');
  const listEl = document.getElementById('admin-files-list');

  function renderFiles() {
    if (!listEl) return;
    const files = getAdminFiles().slice().reverse();
    if (!files.length) {
      listEl.innerHTML = '<p style="color:var(--text-secondary)">لا توجد ملفات مرفوعة.</p>';
      return;
    }
    listEl.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>الاسم</th><th>النوع</th><th>الحجم</th><th>التاريخ</th><th></th></tr></thead>
      <tbody>${files.map(f => `
        <tr>
          <td>${escapeHtml(f.name)}</td>
          <td>${escapeHtml(f.type || '—')}</td>
          <td>${Math.round((f.size || 0) / 1024)} KB</td>
          <td>${new Date(f.uploadedAt).toLocaleString('ar')}</td>
          <td><button type="button" class="btn btn-sm btn-outline" data-del-file="${escapeHtml(f.id)}">حذف</button></td>
        </tr>`).join('')}
      </tbody></table></div>`;
    listEl.querySelectorAll('[data-del-file]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-file');
        saveAdminFiles(getAdminFiles().filter(f => f.id !== id));
        renderFiles();
        showToast('تم حذف الملف');
      });
    });
  }

  function handleFiles(fileList) {
    if (!fileList || !fileList.length) return;
    const files = getAdminFiles();
    Array.from(fileList).forEach(file => {
      files.push({
        id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: file.name,
        type: file.type || file.name.split('.').pop(),
        size: file.size,
        uploadedBy: session.id,
        uploadedAt: new Date().toISOString()
      });
    });
    try {
      requirePermission(PERM.MANAGE_SHARED_FILES);
      saveAdminFiles(files);
      if (typeof DataStore !== 'undefined') DataStore.saveSharedFiles(files);
    } catch (err) {
      showToast(err.message, 'warning');
      return;
    }
    renderFiles();
    showToast('تم رفع ' + fileList.length + ' ملف/ملفات (مشترك مركزي)');
  }

  if (zone && input) {
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });
    input.addEventListener('change', () => handleFiles(input.files));
  }
  renderFiles();
}

/* ---------- Reports (Admin) ---------- */
function initAdminReports(session) {
  const form = document.getElementById('admin-report-form');
  const listEl = document.getElementById('admin-reports-list');

  function renderReports() {
    if (!listEl) return;
    const reports = getAdminReports().slice().reverse();
    if (!reports.length) {
      listEl.innerHTML = '<p style="color:var(--text-secondary)">لا توجد تقارير صادرة بعد.</p>';
      return;
    }
    listEl.innerHTML = reports.map(r => `
      <div class="card" style="margin-bottom:12px;padding:16px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;">
        <div>
          <strong>${escapeHtml(r.title)}</strong>
          <div style="font-size:0.85rem;color:var(--text-secondary)">${escapeHtml(r.audience)} · ${new Date(r.createdAt).toLocaleString('ar')}</div>
        </div>
        <button type="button" class="btn btn-sm btn-primary" data-dl-report="${escapeHtml(r.id)}">تحميل</button>
      </div>
    `).join('');
    listEl.querySelectorAll('[data-dl-report]').forEach(btn => {
      btn.addEventListener('click', () => {
        const r = getAdminReports().find(x => x.id === btn.getAttribute('data-dl-report'));
        if (r) downloadTextFile(r.filename, r.content, 'text/plain;charset=utf-8');
      });
    });
  }

  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      try { requirePermission(PERM.SYSTEM_LOGS_REPORTS); } catch (err) { showToast(err.message, 'warning'); return; }
      const audience = document.getElementById('admin-report-audience').value;
      const language = document.getElementById('admin-report-lang').value;
      const title = document.getElementById('admin-report-title').value.trim() || 'تقرير منصة ماء ريسك';
      const content = buildPlatformReport(audience, language);
      const report = {
        id: 'r_' + Date.now(),
        title,
        audience,
        language,
        content,
        filename: 'maarisk-admin-report-' + Date.now() + '.txt',
        createdBy: session.id,
        createdAt: new Date().toISOString()
      };
      const list = getAdminReports();
      list.push(report);
      saveAdminReports(list);
      renderReports();
      downloadTextFile(report.filename, report.content);
      showToast('تم إصدار التقرير وتحميله');
    });
  }
  renderReports();
}

/* ---------- Password change ---------- */
function initPasswordChange(session) {
  const form = document.getElementById('admin-password-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearAllErrors(form);
    const current = document.getElementById('adm-pass-current').value;
    const next = document.getElementById('adm-pass-new').value;
    const confirm = document.getElementById('adm-pass-confirm').value;
    const btn = form.querySelector('[type="submit"]');
    const original = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    try {
      const sid = (getSession() && getSession().id) || session.id;
      const result = await changePassword(sid, current, next, confirm);
      if (!result.ok) {
        showFormError(form, result.error || 'تعذر التغيير');
        if (typeof showToast === 'function') showToast(result.error || 'تعذر التغيير', 'warning');
        return;
      }
      showFormSuccess(form, 'تم تغيير كلمة المرور بنجاح. استخدمها في الدخول التالي.');
      if (typeof showToast === 'function') showToast('تم تغيير كلمة المرور');
      form.reset();
      updateAuthUI();
    } catch (err) {
      showFormError(form, 'خطأ: ' + (err.message || err));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = original; }
    }
  });
}

/* ---------- User management ---------- */
function initUserManagement(session) {
  const listEl = document.getElementById('admin-users-list');

  function render() {
    if (!listEl) return;
    const users = getUsers().filter(u => u.role !== 'admin');
    if (!users.length) {
      listEl.innerHTML = '<p style="color:var(--text-secondary)">لا يوجد مستخدمون مسجّلون بعد.</p>';
      return;
    }
    listEl.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>تاريخ التسجيل</th><th>إجراءات</th></tr></thead>
      <tbody>${users.map(u => `
        <tr>
          <td>${escapeHtml(u.name)}</td>
          <td dir="ltr">${escapeHtml(u.email)}</td>
          <td>${escapeHtml(u.role || 'user')}</td>
          <td>${u.active === false ? '<span class="badge badge-danger">ملغى</span>' : '<span class="badge badge-success">نشط</span>'}</td>
          <td>${u.createdAt ? new Date(u.createdAt).toLocaleString('ar') : '—'}</td>
          <td style="white-space:nowrap;">
            <button type="button" class="btn btn-sm btn-outline" data-view-user="${escapeHtml(u.id)}">استعراض</button>
            ${u.active === false
              ? `<button type="button" class="btn btn-sm btn-outline" data-reactivate="${escapeHtml(u.id)}">إعادة تفعيل</button>`
              : `<button type="button" class="btn btn-sm btn-outline" data-deactivate="${escapeHtml(u.id)}">إلغاء الاشتراك</button>`}
          </td>
        </tr>`).join('')}
      </tbody></table></div>
      <div id="user-detail-panel" style="margin-top:16px;"></div>`;

    
    listEl.querySelectorAll('[data-view-user]').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = getUsers().find(x => x.id === btn.getAttribute('data-view-user'));
        const panel = document.getElementById('user-detail-panel');
        if (!u || !panel) return;
        panel.innerHTML = `<div class="card" style="padding:16px;">
          <h3 style="margin-bottom:12px;">تفاصيل الحساب</h3>
          <div class="grid-2" style="gap:12px;font-size:0.95rem;">
            <div><strong>الاسم:</strong> ${escapeHtml(u.name)}</div>
            <div><strong>البريد:</strong> <span dir="ltr">${escapeHtml(u.email)}</span></div>
            <div><strong>المعرّف:</strong> <code dir="ltr">${escapeHtml(u.id)}</code></div>
            <div><strong>الدور:</strong> ${escapeHtml(u.role || 'user')}</div>
            <div><strong>الحالة:</strong> ${u.active === false ? 'ملغى الاشتراك' : 'نشط'}</div>
            <div><strong>تاريخ التسجيل:</strong> ${u.createdAt ? new Date(u.createdAt).toLocaleString('ar') : '—'}</div>
          </div>
        </div>`;
      });
    });

    listEl.querySelectorAll('[data-deactivate]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('تأكيد إلغاء اشتراك هذا المستخدم؟')) return;
        let r;
        try { requirePermission(PERM.MANAGE_USERS); r = deactivateUser(btn.getAttribute('data-deactivate')); }
        catch (err) { showToast(err.message, 'warning'); return; }
        if (!r.ok) { showToast(r.error || 'فشل', 'warning'); return; }
        showToast('تم إلغاء الاشتراك');
        render();
      });
    });
    listEl.querySelectorAll('[data-reactivate]').forEach(btn => {
      btn.addEventListener('click', () => {
        reactivateUser(btn.getAttribute('data-reactivate'));
        showToast('تم إعادة التفعيل');
        render();
      });
    });
  }
  render();
}

/* ---------- User inbox ---------- */
function initUserInbox(session) {
  const listEl = document.getElementById('user-inbox-list');
  const replyForm = document.getElementById('user-reply-form');

  function visibleMessages() {
    return getMessages().filter(m =>
      m.to === 'all' || m.to === session.id || m.from === session.id
    ).slice().reverse();
  }

  function render() {
    if (!listEl) return;
    const msgs = visibleMessages();
    if (!msgs.length) {
      listEl.innerHTML = '<p style="color:var(--text-secondary)">صندوق الوارد فارغ.</p>';
      return;
    }
    listEl.innerHTML = msgs.map(m => `
      <div class="card" style="margin-bottom:12px;padding:16px;">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
          <strong>${escapeHtml(m.subject)}</strong>
          <span style="font-size:0.8rem;color:var(--text-secondary)">${new Date(m.createdAt).toLocaleString('ar')}</span>
        </div>
        <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">
          ${m.fromRole === 'admin' ? 'من الإدارة' : 'من: ' + escapeHtml(m.fromName || '')}
          ${m.to === 'all' ? ' · إلى الجميع' : ''}
        </div>
        <div style="white-space:pre-wrap;">${escapeHtml(m.body)}</div>
      </div>
    `).join('');
  }

  render();

  if (replyForm) {
    replyForm.addEventListener('submit', e => {
      e.preventDefault();
      const subject = document.getElementById('reply-subject').value.trim();
      const body = document.getElementById('reply-body').value.trim();
      if (!subject || !body) return;
      const msgs = getMessages();
      msgs.push({
        id: 'm_' + Date.now(),
        from: session.id,
        fromName: session.name,
        fromRole: 'user',
        to: 'admin',
        subject,
        body,
        createdAt: new Date().toISOString(),
        readBy: []
      });
      saveMessages(msgs);
      replyForm.reset();
      render();
      showToast('تم إرسال رسالتك إلى الإدارة');
    });
  }
}
