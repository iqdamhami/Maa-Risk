/* ========================================
   مخزن بيانات مفصول: خاص بالمستخدم × مركزي مشترك
   كل الكتابة تمر عبر فحوصات permissions.js
   ======================================== */

const DataStore = (() => {
  const CENTRAL_PREFIX = 'maarisk_central_';
  const USER_PREFIX = 'maarisk_user_';

  function userKey(userId, name) {
    return USER_PREFIX + userId + '_' + name;
  }
  function centralKey(name) {
    return CENTRAL_PREFIX + name;
  }

  function readJSON(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  /* ---------- بيانات المستخدم الخاصة ---------- */
  function saveUserDataset(userId, dataset) {
    requirePermission(PERM.OWN_DATA_UPLOAD, { requireSelf: true, resourceOwnerId: userId });
    const actor = currentActor();
    if (actor.role !== 'admin' && actor.id !== userId) {
      throw Object.assign(new Error('FORBIDDEN'), { code: 'FORBIDDEN_CROSS_USER' });
    }
    writeJSON(userKey(userId, 'dataset'), dataset);
    auditLog('user_dataset_save', { userId, rows: (dataset.rows || []).length });
    return { ok: true };
  }

  function loadUserDataset(userId) {
    assertCanAccessUserData(userId);
    return readJSON(userKey(userId, 'dataset'), null);
  }

  function saveUserAnalysis(userId, result) {
    requirePermission(PERM.OWN_ANALYSIS);
    const actor = currentActor();
    if (actor.role !== 'admin' && actor.id !== userId) {
      throw Object.assign(new Error('FORBIDDEN'), { code: 'FORBIDDEN_CROSS_USER' });
    }
    writeJSON(userKey(userId, 'analysis'), result);
    auditLog('user_analysis_save', { userId });
    return { ok: true };
  }

  function loadUserAnalysis(userId) {
    assertCanAccessUserData(userId);
    return readJSON(userKey(userId, 'analysis'), null);
  }

  function saveUserReport(userId, report) {
    requirePermission(PERM.OWN_REPORTS);
    const actor = currentActor();
    if (actor.role !== 'admin' && actor.id !== userId) {
      throw Object.assign(new Error('FORBIDDEN'), { code: 'FORBIDDEN_CROSS_USER' });
    }
    const list = readJSON(userKey(userId, 'reports'), []);
    list.push({ ...report, id: report.id || ('ur_' + Date.now()), createdAt: new Date().toISOString() });
    writeJSON(userKey(userId, 'reports'), list);
    auditLog('user_report_save', { userId });
    return { ok: true };
  }

  function loadUserReports(userId) {
    assertCanAccessUserData(userId);
    return readJSON(userKey(userId, 'reports'), []);
  }

  function saveUserProjectState(userId, state) {
    const actor = currentActor();
    if (!actor) throw Object.assign(new Error('UNAUTHORIZED'), { code: 'UNAUTHORIZED' });
    if (actor.role !== 'admin' && actor.id !== userId) {
      throw Object.assign(new Error('FORBIDDEN'), { code: 'FORBIDDEN_CROSS_USER' });
    }
    writeJSON(userKey(userId, 'project_state'), state);
    return { ok: true };
  }

  function loadUserProjectState(userId) {
    assertCanAccessUserData(userId);
    return readJSON(userKey(userId, 'project_state'), null);
  }

  /* ---------- بيانات مركزية (Admin فقط للكتابة) ---------- */
  function saveCentralDataset(dataset) {
    requirePermission(PERM.MANAGE_CENTRAL_DATA);
    writeJSON(centralKey('dataset'), dataset);
    auditLog('central_dataset_save', { rows: (dataset.rows || []).length });
    return { ok: true };
  }

  function loadCentralDataset() {
    // قراءة مركزية متاحة للجميع للعرض المعتمد؛ التعديل لا
    return readJSON(centralKey('dataset'), null);
  }

  function deleteCentralDataset() {
    requirePermission(PERM.MANAGE_CENTRAL_DATA);
    localStorage.removeItem(centralKey('dataset'));
    auditLog('central_dataset_delete', {});
    return { ok: true };
  }

  function saveSharedFiles(files) {
    requirePermission(PERM.MANAGE_SHARED_FILES);
    writeJSON(centralKey('shared_files'), files);
    auditLog('shared_files_save', { count: (files || []).length });
    return { ok: true };
  }

  function loadSharedFiles() {
    return readJSON(centralKey('shared_files'), []);
  }

  function deleteSharedFile(fileId) {
    requirePermission(PERM.MANAGE_SHARED_FILES);
    const files = loadSharedFiles().filter(f => f.id !== fileId);
    writeJSON(centralKey('shared_files'), files);
    auditLog('shared_file_delete', { fileId });
    return { ok: true };
  }

  function saveScienceConfig(config) {
    requirePermission(PERM.EDIT_SCIENCE_CONFIG);
    writeJSON(centralKey('science_config'), config);
    auditLog('science_config_save', {});
    return { ok: true };
  }

  function loadScienceConfig() {
    return readJSON(centralKey('science_config'), {
      weights: { drought: 0.34, water: 0.33, health: 0.33 },
      forecastHorizon: 6,
      scenarios: null
    });
  }

  function saveEbaCatalog(catalog) {
    requirePermission(PERM.MANAGE_EBA_CATALOG);
    writeJSON(centralKey('eba_catalog'), catalog);
    auditLog('eba_catalog_save', {});
    return { ok: true };
  }

  function loadEbaCatalog() {
    return readJSON(centralKey('eba_catalog'), null);
  }

  function saveSystemSettings(settings) {
    requirePermission(PERM.SYSTEM_SETTINGS);
    writeJSON(centralKey('system_settings'), settings);
    auditLog('system_settings_save', {});
    return { ok: true };
  }

  function loadSystemSettings() {
    return readJSON(centralKey('system_settings'), { version: '1.0' });
  }

  function getAuditLog() {
    requirePermission(PERM.SYSTEM_LOGS_REPORTS);
    return readJSON('maarisk_audit_log', []);
  }

  return {
    saveUserDataset, loadUserDataset,
    saveUserAnalysis, loadUserAnalysis,
    saveUserReport, loadUserReports,
    saveUserProjectState, loadUserProjectState,
    saveCentralDataset, loadCentralDataset, deleteCentralDataset,
    saveSharedFiles, loadSharedFiles, deleteSharedFile,
    saveScienceConfig, loadScienceConfig,
    saveEbaCatalog, loadEbaCatalog,
    saveSystemSettings, loadSystemSettings,
    getAuditLog
  };
})();

window.DataStore = DataStore;
