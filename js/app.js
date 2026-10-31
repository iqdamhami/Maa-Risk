/* ========================================
   ماء ريسك - Shared App Logic + Interactivity
   ======================================== */

const translations = {
  ar: {
    "logo": "ماء ريسك",
    "nav_home": "الرئيسية",
    "nav_data": "البيانات",
    "nav_risk": "المخاطر",
    "nav_maps": "الخرائط",
    "nav_solutions": "الحلول",
    "nav_costing": "التكاليف",
    "nav_reports": "التقارير",
    "nav_cta": "تجربة المنصة",
    "nav_messages": "الرسائل",
    "nav_admin": "الإدارة",
    "nav_login": "دخول",
    "nav_register": "إنشاء حساب",
    "nav_logout": "خروج",
    "step1": "البيانات",
    "step2": "المخاطر",
    "step3": "الخرائط",
    "step4": "الحلول",
    "step5": "التكاليف",
    "step6": "التقارير",
    "next": "التالي",
    "prev": "السابق",
    "save": "حفظ",
    "export": "تصدير",
    "upload": "رفع ملفات",
    "demo_data": "استخدام البيانات التجريبية",
    "run_analysis": "تشغيل التحليل",
    "generate_report": "إصدار التقرير",
    "footer_desc": "منصة متكاملة لإدارة مخاطر شح المياه والجفاف والهشاشة الصحية المرتبطة بالمناخ.",
    "footer_col1": "المنصة",
    "copyright": "© 2026 ماء ريسك. جميع الحقوق محفوظة.",
    "footer_lang": "العربية · English · Français",
    "toast_saved": "تم الحفظ بنجاح",
    "toast_demo": "تم تحميل البيانات التجريبية",
    "toast_analysis": "اكتمل التحليل",
    "toast_report": "تم إنشاء التقرير",
    "toast_upload": "تم استلام الملفات",
    "toast_select": "يرجى اختيار حل واحد على الأقل",
    "login_title": "تسجيل الدخول",
    "login_subtitle": "مرحباً بعودتك إلى منصة ماء ريسك",
    "email": "البريد الإلكتروني",
    "password": "كلمة المرور",
    "name": "الاسم",
    "confirm_password": "تأكيد كلمة المرور",
    "login_btn": "تسجيل الدخول",
    "register_btn": "إنشاء حساب",
    "register_title": "إنشاء حساب",
    "no_account": "ليس لديك حساب؟",
    "has_account": "لديك حساب بالفعل؟",
    "create_account": "إنشاء حساب جديد",
    "login_note": "استخدم حسابك المسجّل. عند فشل الدخول تظهر رسالة موحّدة لحماية الخصوصية.",
    "register_note": "يُنصح باستخدام كلمة مرور قوية. في بيئة الإنتاج تُدار المصادقة عبر خادم آمن.",
    "terms_agree": "أوافق على الشروط والأحكام وسياسة الخصوصية الخاصة بالمنصة",
    "admin_title": "لوحة الإدارة",
    "admin_messages": "الرسائل",
    "admin_uploads": "الملفات",
    "admin_reports": "التقارير",
    "admin_users": "المستخدمون",
    "admin_password": "كلمة المرور",
    "data_title": "البيانات",
    "risk_title": "تقييم المخاطر والتوقعات",
    "maps_title": "الخرائط",
    "solutions_title": "الحلول",
    "costing_title": "التكاليف والتمويل",
    "reports_title": "التقارير والتوصيات",
    "messages_title": "صندوق الرسائل",
    "inbox": "صندوق الوارد",
    "quality": "الجودة",
    "source": "المصدر",
    "period": "الفترة",
    "type": "النوع",
    "name_col": "الاسم",
    "status": "الحالة",
    "active": "نشط",
    "inactive": "ملغى",
    "actions": "إجراءات",
    "view": "استعراض",
    "deactivate": "إلغاء الاشتراك",
    "reactivate": "إعادة تفعيل",
    "send": "إرسال",
    "subject": "الموضوع",
    "body": "نص الرسالة",
    "to_all": "للجميع",
    "to_user": "لمستخدم محدد",
    "change_password": "تغيير كلمة المرور",
    "current_password": "كلمة المرور الحالية",
    "new_password": "كلمة المرور الجديدة",
    "password_changed": "تم تغيير كلمة المرور بنجاح",
    "invalid_credentials": "البريد أو كلمة المرور غير صحيحة",
    "required_field": "هذا الحقل مطلوب",
    "password_min": "8 أحرف على الأقل",
    "analysis_results": "نتائج المحرك العلمي",
    "demo_badge": "بيانات تجريبية — ليست فعلية",
    "user_data_badge": "بيانات مستخدم",
    "latest_spi": "SPI الأخير",
    "mean_deficit": "متوسط العجز المائي",
    "composite_index": "المؤشر المركّب",
    "forecast_title": "تنبؤ الأمطار",
    "scenarios": "سيناريوهات",
    "data_quality": "جودة البيانات",
    "assumptions": "افتراضات ومعادلات",
    "select_solutions": "اختر الحلول للمقارنة",
    "water_saved": "مياه محفوظة",
    "cost": "التكلفة",
    "benefit": "المنافع",
    "equity": "عدالة التوزيع",
    "layer_water": "شح المياه",
    "layer_drought": "الجفاف",
    "layer_health": "الهشاشة الصحية",
    "priority_zones": "مناطق الأولوية",
    "funding": "التمويل",
    "proposal_draft": "مسودة مقترح",
    "download_csv_template": "تحميل نموذج البيانات (CSV)",
    "explore_modules": "استكشف الوحدات",
    "try_platform": "تجربة المنصة",
    "hero_title": "منصة متكاملة لمخاطر المياه والمناخ والصحة",
    "hero_sub": "من جمع البيانات إلى التحليل والتنبؤ والخرائط وحلول التكيف والتمويل والتقارير."
  },
  en: {
    "logo": "Mā’ Risk",
    "nav_home": "Home",
    "nav_data": "Data",
    "nav_risk": "Risks",
    "nav_maps": "Maps",
    "nav_solutions": "Solutions",
    "nav_costing": "Costing",
    "nav_reports": "Reports",
    "nav_cta": "Try platform",
    "nav_messages": "Messages",
    "nav_admin": "Admin",
    "nav_login": "Sign in",
    "nav_register": "Register",
    "nav_logout": "Sign out",
    "step1": "Data",
    "step2": "Risks",
    "step3": "Maps",
    "step4": "Solutions",
    "step5": "Costing",
    "step6": "Reports",
    "next": "Next",
    "prev": "Previous",
    "save": "Save",
    "export": "Export",
    "upload": "Upload files",
    "demo_data": "Use demo data",
    "run_analysis": "Run analysis",
    "generate_report": "Generate report",
    "footer_desc": "Integrated platform for water scarcity, drought and climate-related health vulnerability.",
    "footer_col1": "Platform",
    "copyright": "© 2026 Mā’ Risk. All rights reserved.",
    "footer_lang": "العربية · English · Français",
    "toast_saved": "Saved successfully",
    "toast_demo": "Demo data loaded",
    "toast_analysis": "Analysis complete",
    "toast_report": "Report generated",
    "toast_upload": "Files received",
    "toast_select": "Please select at least one solution",
    "login_title": "Sign in",
    "login_subtitle": "Welcome back to Mā’ Risk",
    "email": "Email",
    "password": "Password",
    "name": "Full name",
    "confirm_password": "Confirm password",
    "login_btn": "Sign in",
    "register_btn": "Create account",
    "register_title": "Create account",
    "no_account": "No account yet?",
    "has_account": "Already have an account?",
    "create_account": "Create a new account",
    "login_note": "Use your registered account. Failed sign-in shows a generic message to protect privacy.",
    "register_note": "Use a strong password. In production, authentication is handled by a secure server.",
    "terms_agree": "I agree to the platform terms and privacy policy",
    "admin_title": "Admin panel",
    "admin_messages": "Messages",
    "admin_uploads": "Files",
    "admin_reports": "Reports",
    "admin_users": "Users",
    "admin_password": "Password",
    "data_title": "Data",
    "risk_title": "Risk assessment & forecasts",
    "maps_title": "Maps",
    "solutions_title": "Solutions",
    "costing_title": "Costing & finance",
    "reports_title": "Reports & recommendations",
    "messages_title": "Inbox",
    "inbox": "Inbox",
    "quality": "Quality",
    "source": "Source",
    "period": "Period",
    "type": "Type",
    "name_col": "Name",
    "status": "Status",
    "active": "Active",
    "inactive": "Deactivated",
    "actions": "Actions",
    "view": "View",
    "deactivate": "Deactivate",
    "reactivate": "Reactivate",
    "send": "Send",
    "subject": "Subject",
    "body": "Message body",
    "to_all": "Everyone",
    "to_user": "Specific user",
    "change_password": "Change password",
    "current_password": "Current password",
    "new_password": "New password",
    "password_changed": "Password changed successfully",
    "invalid_credentials": "Invalid email or password",
    "required_field": "This field is required",
    "password_min": "At least 8 characters",
    "analysis_results": "Scientific engine results",
    "demo_badge": "Demo data — not operational",
    "user_data_badge": "User data",
    "latest_spi": "Latest SPI",
    "mean_deficit": "Mean water deficit",
    "composite_index": "Composite index",
    "forecast_title": "Rainfall forecast",
    "scenarios": "Scenarios",
    "data_quality": "Data quality",
    "assumptions": "Assumptions & equations",
    "select_solutions": "Select solutions to compare",
    "water_saved": "Water saved",
    "cost": "Cost",
    "benefit": "Benefits",
    "equity": "Equity",
    "layer_water": "Water scarcity",
    "layer_drought": "Drought",
    "layer_health": "Health vulnerability",
    "priority_zones": "Priority zones",
    "funding": "Funding",
    "proposal_draft": "Proposal draft",
    "download_csv_template": "Download data template (CSV)",
    "explore_modules": "Explore modules",
    "try_platform": "Try the platform",
    "hero_title": "Integrated platform for water, climate and health risks",
    "hero_sub": "From data collection to analysis, forecasts, maps, EbA solutions, financing and reports."
  },
  fr: {
    "logo": "Mā’ Risk",
    "nav_home": "Accueil",
    "nav_data": "Données",
    "nav_risk": "Risques",
    "nav_maps": "Cartes",
    "nav_solutions": "Solutions",
    "nav_costing": "Coûts",
    "nav_reports": "Rapports",
    "nav_cta": "Essayer",
    "nav_messages": "Messages",
    "nav_admin": "Admin",
    "nav_login": "Connexion",
    "nav_register": "S’inscrire",
    "nav_logout": "Déconnexion",
    "step1": "Données",
    "step2": "Risques",
    "step3": "Cartes",
    "step4": "Solutions",
    "step5": "Coûts",
    "step6": "Rapports",
    "next": "Suivant",
    "prev": "Précédent",
    "save": "Enregistrer",
    "export": "Exporter",
    "upload": "Téléverser",
    "demo_data": "Utiliser les données démo",
    "run_analysis": "Lancer l’analyse",
    "generate_report": "Générer le rapport",
    "footer_desc": "Plateforme intégrée pour la rareté de l’eau, la sécheresse et la vulnérabilité sanitaire liée au climat.",
    "footer_col1": "Plateforme",
    "copyright": "© 2026 Mā’ Risk. Tous droits réservés.",
    "footer_lang": "العربية · English · Français",
    "toast_saved": "Enregistré avec succès",
    "toast_demo": "Données démo chargées",
    "toast_analysis": "Analyse terminée",
    "toast_report": "Rapport généré",
    "toast_upload": "Fichiers reçus",
    "toast_select": "Veuillez sélectionner au moins une solution",
    "login_title": "Connexion",
    "login_subtitle": "Bon retour sur Mā’ Risk",
    "email": "E-mail",
    "password": "Mot de passe",
    "name": "Nom complet",
    "confirm_password": "Confirmer le mot de passe",
    "login_btn": "Se connecter",
    "register_btn": "Créer un compte",
    "register_title": "Créer un compte",
    "no_account": "Pas encore de compte ?",
    "has_account": "Déjà un compte ?",
    "create_account": "Créer un nouveau compte",
    "login_note": "Utilisez votre compte enregistré. Un message générique s’affiche en cas d’échec pour protéger la confidentialité.",
    "register_note": "Utilisez un mot de passe fort. En production, l’authentification est gérée par un serveur sécurisé.",
    "terms_agree": "J’accepte les conditions et la politique de confidentialité de la plateforme",
    "admin_title": "Panneau d’administration",
    "admin_messages": "Messages",
    "admin_uploads": "Fichiers",
    "admin_reports": "Rapports",
    "admin_users": "Utilisateurs",
    "admin_password": "Mot de passe",
    "data_title": "Données",
    "risk_title": "Évaluation des risques et prévisions",
    "maps_title": "Cartes",
    "solutions_title": "Solutions",
    "costing_title": "Coûts et financement",
    "reports_title": "Rapports et recommandations",
    "messages_title": "Boîte de réception",
    "inbox": "Boîte de réception",
    "quality": "Qualité",
    "source": "Source",
    "period": "Période",
    "type": "Type",
    "name_col": "Nom",
    "status": "Statut",
    "active": "Actif",
    "inactive": "Désactivé",
    "actions": "Actions",
    "view": "Voir",
    "deactivate": "Désactiver",
    "reactivate": "Réactiver",
    "send": "Envoyer",
    "subject": "Objet",
    "body": "Message",
    "to_all": "Tout le monde",
    "to_user": "Utilisateur spécifique",
    "change_password": "Changer le mot de passe",
    "current_password": "Mot de passe actuel",
    "new_password": "Nouveau mot de passe",
    "password_changed": "Mot de passe modifié avec succès",
    "invalid_credentials": "E-mail ou mot de passe incorrect",
    "required_field": "Ce champ est obligatoire",
    "password_min": "Au moins 8 caractères",
    "analysis_results": "Résultats du moteur scientifique",
    "demo_badge": "Données démo — non opérationnelles",
    "user_data_badge": "Données utilisateur",
    "latest_spi": "Dernier SPI",
    "mean_deficit": "Déficit hydrique moyen",
    "composite_index": "Indice composite",
    "forecast_title": "Prévision des précipitations",
    "scenarios": "Scénarios",
    "data_quality": "Qualité des données",
    "assumptions": "Hypothèses et équations",
    "select_solutions": "Sélectionnez les solutions à comparer",
    "water_saved": "Eau économisée",
    "cost": "Coût",
    "benefit": "Avantages",
    "equity": "Équité",
    "layer_water": "Rareté de l’eau",
    "layer_drought": "Sécheresse",
    "layer_health": "Vulnérabilité sanitaire",
    "priority_zones": "Zones prioritaires",
    "funding": "Financement",
    "proposal_draft": "Brouillon de proposition",
    "download_csv_template": "Télécharger le modèle de données (CSV)",
    "explore_modules": "Explorer les modules",
    "try_platform": "Essayer la plateforme",
    "hero_title": "Plateforme intégrée des risques eau, climat et santé",
    "hero_sub": "De la collecte de données à l’analyse, aux prévisions, cartes, solutions EbA, financement et rapports."
  }
};

let currentLang = localStorage.getItem('lang') || 'ar';

function t(key) {
  const pack = translations[currentLang] || {};
  if (Object.prototype.hasOwnProperty.call(pack, key) && pack[key] !== '') return pack[key];
  // لا نُرجع العربية تلقائياً عند اختيار en/fr — نُبلغ عن المفتاح الناقص
  if (currentLang !== 'ar' && translations.ar && translations.ar[key]) {
    console.warn('[i18n missing]', currentLang, key);
  }
  return pack[key] || key;
}

function setLanguage(lang) {
  if (!translations[lang]) lang = 'ar';
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang === 'ar' ? 'ar' : lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (el.hasAttribute('data-i18n-placeholder')) el.placeholder = val;
      else el.value = val;
    } else {
      el.textContent = val;
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  document.dispatchEvent(new CustomEvent('maarisk:lang', { detail: { lang } }));
}

/* ========== Theme ========== */
let isDark = localStorage.getItem('theme') === 'dark' ||
  (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);

function applyTheme() {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

/* ========== Toast Notifications ========== */
function showToast(message, type = 'success', duration = 3200) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span><button class="toast-close" aria-label="Close">&times;</button>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  const remove = () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  };
  toast.querySelector('.toast-close').onclick = remove;
  setTimeout(remove, duration);
}

/* ========== Project State (localStorage) ========== */
const STATE_KEY = 'maarisk_project';

const defaultState = {
  demoLoaded: false,
  dataRows: [],
  analysisDone: false,
  riskScores: null,
  selectedSolutions: ['rainwater', 'valleys', 'pastures'],
  layers: { water: true, drought: true, health: true, density: false, access: false },
  reportSettings: { audience: 'funders', lang: 'ar', detail: 'standard' }
};

function getState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? { ...defaultState, ...JSON.parse(raw) } : { ...defaultState };
  } catch {
    return { ...defaultState };
  }
}

function setState(partial) {
  const next = { ...getState(), ...partial };
  localStorage.setItem(STATE_KEY, JSON.stringify(next));
  return next;
}

function saveProject() {
  setState({ lastSaved: new Date().toISOString() });
  showToast(t('toast_saved'));
}

/* ========== Demo datasets ========== */
const DEMO_DATA_ROWS = [
  { name: 'أمطار شهرية – حوض وادي رم', type: 'مناخي', source: 'دائرة الأرصاد', period: '2010–2024', quality: 'high' },
  { name: 'مؤشر SPI للجفاف', type: 'جفاف', source: 'حساب من الأمطار', period: '2010–2024', quality: 'high' },
  { name: 'مناسيب المياه الجوفية', type: 'مياه', source: 'سلطة المياه', period: '2015–2023', quality: 'medium' },
  { name: 'حالات الإسهال والأمراض المنقولة', type: 'صحة', source: 'وزارة الصحة', period: '2018–2023', quality: 'medium' },
  { name: 'الكثافة السكانية والوصول للمياه', type: 'ديموغرافي', source: 'الإحصاءات العامة', period: '2023', quality: 'high' }
];

const SOLUTIONS_DATA = [
  { id: 'rainwater', name: 'حصاد مياه الأمطار', water: 1.2, cost: 1.9, maint: 0.25, benefit: 1.4, score: 8.4, equity: 'جيدة', env: 'عالية', health: 'عالية' },
  { id: 'valleys', name: 'استعادة الأودية', water: 0.9, cost: 2.1, maint: 0.35, benefit: 1.1, score: 7.9, equity: 'جيدة', env: 'عالية جداً', health: 'متوسطة' },
  { id: 'pastures', name: 'تأهيل المراعي', water: 0.6, cost: 0.8, maint: 0.15, benefit: 0.7, score: 7.6, equity: 'ممتازة', env: 'عالية', health: 'متوسطة' },
  { id: 'agroforest', name: 'الزراعة الحرجية', water: 0.45, cost: 1.1, maint: 0.2, benefit: 0.55, score: 7.1, equity: 'متوسطة', env: 'عالية', health: 'جيدة' },
  { id: 'irrigation', name: 'تحسين كفاءة الري', water: 0.7, cost: 0.6, maint: 0.1, benefit: 0.5, score: 6.5, equity: 'محدودة', env: 'متوسطة', health: 'متوسطة' }
];

/* ========== Init ========== */
document.addEventListener('DOMContentLoaded', () => {
  setLanguage(currentLang);
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  applyTheme();
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      isDark = !isDark;
      applyTheme();
    });
  }

  const menuToggle = document.getElementById('menuToggle');
  const mobileNav = document.getElementById('mobileNav');
  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', () => mobileNav.classList.toggle('open'));
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => mobileNav.classList.remove('open'));
    });
  }

  // Global save buttons
  document.querySelectorAll('[data-action="save"]').forEach(btn => {
    btn.addEventListener('click', saveProject);
  });

  // Page-specific init
  const page = document.body.dataset.page;
  if (page && window.PageModules && window.PageModules[page]) {
    window.PageModules[page]();
  }
});
