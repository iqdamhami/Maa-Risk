/* ========================================
   حارس المسارات — يمنع الزائر (Guest) من الوحدات التشغيلية
   ======================================== */

(function () {
  /** صفحات عامة مسموحة بدون تسجيل دخول */
  const PUBLIC_PAGES = [
    'index.html',
    '',
    'login.html',
    'register.html'
  ];

  /** صفحات تشغيلية تتطلب جلسة */
  const PROTECTED_PAGES = [
    'data.html',
    'risk.html',
    'maps.html',
    'solutions.html',
    'costing.html',
    'reports.html',
    'messages.html',
    'admin.html'
  ];

  function pageName() {
    const p = (window.location.pathname || '').split('/').pop() || '';
    return p.toLowerCase();
  }

  function isLoggedInSession() {
    try {
      if (typeof getSession === 'function') {
        const s = getSession();
        if (s && s.id) return true;
      }
      const raw = localStorage.getItem('maarisk_session');
      if (!raw) return false;
      const s = JSON.parse(raw);
      return !!(s && s.id);
    } catch (e) {
      return false;
    }
  }

  function loginUrl() {
    const name = pageName();
    const inPages = (window.location.pathname || '').includes('/pages/');
    const base = inPages ? 'login.html' : 'pages/login.html';
    const returnTo = encodeURIComponent(
      (inPages ? name : ('pages/' + name)) + (window.location.search || '') + (window.location.hash || '')
    );
    return base + '?return=' + returnTo;
  }

  function enforceGuestGuard() {
    const name = pageName();
    const needsAuth = PROTECTED_PAGES.indexOf(name) !== -1;
    if (!needsAuth) return;

    if (!isLoggedInSession()) {
      // منع تنفيذ أي منطق تشغيلي على الصفحة
      try {
        window.__MAARISK_GUEST_BLOCKED__ = true;
      } catch (e) {}
      window.location.replace(loginUrl());
    }
  }

  // تشغيل فوري قبل باقي السكربتات إن أمكن
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enforceGuestGuard);
  } else {
    enforceGuestGuard();
  }

  // حراسة استدعاءات شائعة إن حاول الزائر من الكونسول
  window.requireLoginForAction = function (actionName) {
    if (isLoggedInSession()) return true;
    if (typeof showToast === 'function') {
      showToast('يلزم تسجيل الدخول لتنفيذ: ' + (actionName || 'هذه العملية'), 'warning');
    }
    window.location.href = loginUrl();
    return false;
  };

  window.isGuest = function () {
    return !isLoggedInSession();
  };
})();
