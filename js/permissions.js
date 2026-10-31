/* ========================================
   ماء ريسك — طبقة الصلاحيات (Authorization Gate)
   كل عملية حساسة تمر من هنا قبل الكتابة/القراءة المشتركة.
   في الإنتاج تُنفَّذ نفس القواعد على الخادم؛ هنا محاكاة خادم محلي متسقة.
   ======================================== */

const PERM = {
  // إدارية حصرية
  MANAGE_USERS: 'manage_users',
  CHANGE_ROLES: 'change_roles',
  MANAGE_CENTRAL_DATA: 'manage_central_data',
  MANAGE_SHARED_FILES: 'manage_shared_files',
  EDIT_SCIENCE_CONFIG: 'edit_science_config',
  MANAGE_EBA_CATALOG: 'manage_eba_catalog',
  SYSTEM_SETTINGS: 'system_settings',
  VIEW_OTHERS_PRIVATE: 'view_others_private',
  SYSTEM_LOGS_REPORTS: 'system_logs_reports',
  RESET_PASSWORDS: 'reset_passwords',
  BROADCAST_MESSAGES: 'broadcast_messages',
  // علمية للمستخدم (والأدمن)
  OWN_DATA_UPLOAD: 'own_data_upload',
  OWN_ANALYSIS: 'own_analysis',
  OWN_MAPS: 'own_maps',
  OWN_SOLUTIONS: 'own_solutions',
  OWN_COSTING: 'own_costing',
  OWN_REPORTS: 'own_reports',
  REPLY_MESSAGES: 'reply_messages'
};

const ROLE_PERMS = {
  admin: Object.values(PERM),
  user: [
    PERM.OWN_DATA_UPLOAD,
    PERM.OWN_ANALYSIS,
    PERM.OWN_MAPS,
    PERM.OWN_SOLUTIONS,
    PERM.OWN_COSTING,
    PERM.OWN_REPORTS,
    PERM.REPLY_MESSAGES
  ]
};

function currentActor() {
  if (typeof getSession !== 'function') return null;
  const s = getSession();
  if (!s) return null;
  return {
    id: s.id,
    email: s.email,
    name: s.name,
    role: s.role === 'admin' ? 'admin' : 'user'
  };
}

function hasPermission(permission, actor) {
  const a = actor || currentActor();
  if (!a) return false;
  const list = ROLE_PERMS[a.role] || ROLE_PERMS.user;
  return list.includes(permission);
}

/**
 * بوابة خادم محلي — ترفض العملية برمي خطأ إن لم تُستوفَ الصلاحية
 * @returns {{ ok: true, actor } | never}
 */
function requirePermission(permission, opts = {}) {
  const actor = currentActor();
  if (!actor) {
    const err = new Error('UNAUTHORIZED: يلزم تسجيل الدخول');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (!hasPermission(permission, actor)) {
    const err = new Error('FORBIDDEN: صلاحية غير كافية (' + permission + ')');
    err.code = 'FORBIDDEN';
    err.permission = permission;
    throw err;
  }
  if (opts.requireSelf && opts.resourceOwnerId && opts.resourceOwnerId !== actor.id && actor.role !== 'admin') {
    const err = new Error('FORBIDDEN: لا يمكن الوصول لبيانات مستخدم آخر');
    err.code = 'FORBIDDEN_CROSS_USER';
    throw err;
  }
  return { ok: true, actor };
}

function requireAdmin() {
  return requirePermission(PERM.MANAGE_USERS);
}

function assertCanAccessUserData(targetUserId) {
  const actor = currentActor();
  if (!actor) throw Object.assign(new Error('UNAUTHORIZED'), { code: 'UNAUTHORIZED' });
  if (actor.role === 'admin') {
    requirePermission(PERM.VIEW_OTHERS_PRIVATE);
    return { ok: true, actor };
  }
  if (actor.id !== targetUserId) {
    throw Object.assign(new Error('FORBIDDEN: بيانات مستخدم آخر'), { code: 'FORBIDDEN_CROSS_USER' });
  }
  return { ok: true, actor };
}

/** سجل تدقيق محلي */
function auditLog(action, details) {
  try {
    const key = 'maarisk_audit_log';
    const log = JSON.parse(localStorage.getItem(key) || '[]');
    const actor = currentActor();
    log.push({
      at: new Date().toISOString(),
      action,
      actorId: actor && actor.id,
      actorRole: actor && actor.role,
      details: details || {}
    });
    // احتفظ بآخر 500
    localStorage.setItem(key, JSON.stringify(log.slice(-500)));
  } catch (e) { /* ignore */ }
}

window.PERM = PERM;
window.hasPermission = hasPermission;
window.requirePermission = requirePermission;
window.requireAdmin = requireAdmin;
window.assertCanAccessUserData = assertCanAccessUserData;
window.auditLog = auditLog;
window.currentActor = currentActor;
