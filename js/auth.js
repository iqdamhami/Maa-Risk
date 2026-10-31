/* ========================================
   ماء ريسك - Authentication (Frontend Demo)
   يعمل على file:// و localhost
   ======================================== */

const AUTH_USERS_KEY = 'maarisk_users';
const AUTH_SESSION_KEY = 'maarisk_session';
const ADMIN_PASS_KEY = 'maarisk_admin_pass_hash';

/* ---- تجزئة ثابتة وموثوقة (لا تعتمد على حالة مشتركة) ---- */
function sha256Hex(message) {
  // SHA-256 نقي — يعاد تهيئة الثوابت في كل استدعاء
  function rr(n, x) { return (x >>> n) | (x << (32 - n)); }
  var k = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  var h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,
      h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  // دعم UTF-8
  var bytes = [];
  for (var i = 0; i < message.length; i++) {
    var c = message.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0xd800 || c >= 0xe000)
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else {
      i++;
      var cp = 0x10000 + (((c & 0x3ff) << 10) | (message.charCodeAt(i) & 0x3ff));
      bytes.push(0xf0|(cp>>18), 0x80|((cp>>12)&0x3f), 0x80|((cp>>6)&0x3f), 0x80|(cp&0x3f));
    }
  }
  var bitLen = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  for (var t = 24; t >= 0; t -= 8) bytes.push((Math.floor(bitLen / Math.pow(2, 32)) >>> t) & 0xff);
  for (t = 24; t >= 0; t -= 8) bytes.push((bitLen >>> t) & 0xff);

  for (var chunk = 0; chunk < bytes.length; chunk += 64) {
    var w = new Array(64);
    for (i = 0; i < 16; i++) {
      var j = chunk + i * 4;
      w[i] = (bytes[j] << 24) | (bytes[j+1] << 16) | (bytes[j+2] << 8) | bytes[j+3];
    }
    for (i = 16; i < 64; i++) {
      var s0 = rr(7, w[i-15]) ^ rr(18, w[i-15]) ^ (w[i-15] >>> 3);
      var s1 = rr(17, w[i-2]) ^ rr(19, w[i-2]) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    var a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for (i = 0; i < 64; i++) {
      var S1 = rr(6,e) ^ rr(11,e) ^ rr(25,e);
      var ch = (e & f) ^ (~e & g);
      var t1 = (h + S1 + ch + k[i] + w[i]) | 0;
      var S0 = rr(2,a) ^ rr(13,a) ^ rr(22,a);
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var t2 = (S0 + maj) | 0;
      h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
    }
    h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0;
    h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+h)|0;
  }
  function hex(n) {
    var s = '';
    for (var i = 7; i >= 0; i--) s += ((n >>> (i * 4)) & 0xf).toString(16);
    return s;
  }
  return hex(h0)+hex(h1)+hex(h2)+hex(h3)+hex(h4)+hex(h5)+hex(h6)+hex(h7);
}

async function hashPassword(password) {
  return sha256Hex(String(password) + 'maarisk_salt_v1');
}

async function getAdminPassHash() {
  const stored = localStorage.getItem(ADMIN_PASS_KEY);
  if (stored) return stored;
  const h = await hashPassword('Admin@123');
  localStorage.setItem(ADMIN_PASS_KEY, h);
  return h;
}

async function setAdminPassHash(password) {
  const h = await hashPassword(password);
  localStorage.setItem(ADMIN_PASS_KEY, h);
  return h;
}


function getUsers() {
  try { return JSON.parse(localStorage.getItem(AUTH_USERS_KEY) || '[]'); }
  catch { return []; }
}

function saveUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function getSession() {
  try { return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || 'null'); }
  catch { return null; }
}

function setSession(user) {
  const session = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'user',
    loggedAt: new Date().toISOString()
  };
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  return session;
}

function clearSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem('maarisk_api_token');
}

function setApiSession(token, user) {
  localStorage.setItem('maarisk_api_token', token);
  setSession({
    id: user.id,
    name: user.full_name || user.name || 'User',
    email: user.email,
    role: user.role || 'user',
    must_change_password: !!user.must_change_password
  });
}


function isLoggedIn() { return !!getSession(); }
function isAdmin() { const s = getSession(); return s && s.role === 'admin'; }

/** يضمن وجود حساب المدير مرة واحدة دون إعادة ضبط كلمة المرور في كل زيارة */
async function ensureAdminAccount() {
  const email = 'admin@maarisk.org';
  let users = getUsers();
  // أزل أي تكرار لبريد المدير
  users = users.filter((u, i, arr) => {
    if (u.email !== email && u.id !== 'u_admin_default') return true;
    return arr.findIndex(x => x.email === email || x.id === 'u_admin_default') === i;
  });
  const idx = users.findIndex(u => u.email === email || u.id === 'u_admin_default');
  if (idx === -1) {
    users.push({
      id: 'u_admin_default',
      name: 'Admin',
      email,
      passwordHash: await hashPassword('Admin@123'),
      role: 'admin',
      active: true,
      createdAt: new Date().toISOString()
    });
    saveUsers(users);
  } else {
    let changed = false;
    if (users[idx].name !== 'Admin') { users[idx].name = 'Admin'; changed = true; }
    if (users[idx].role !== 'admin') { users[idx].role = 'admin'; changed = true; }
    if (users[idx].email !== email) { users[idx].email = email; changed = true; }
    if (users[idx].id !== 'u_admin_default') { users[idx].id = 'u_admin_default'; changed = true; }
    if (users[idx].active === false) { users[idx].active = true; changed = true; }
    if (!users[idx].passwordHash) {
      users[idx].passwordHash = await hashPassword('Admin@123');
      changed = true;
    }
    if (changed) saveUsers(users);
  }
}

const validators = {
  name(value) {
    const v = (value || '').trim();
    if (!v) return { ok: false, msg: { ar: 'الاسم مطلوب', en: 'Name is required', fr: 'Le nom est requis' } };
    if (v.length < 2) return { ok: false, msg: { ar: 'الاسم قصير جداً', en: 'Name is too short', fr: 'Nom trop court' } };
    return { ok: true };
  },
  email(value) {
    const v = (value || '').trim().toLowerCase();
    if (!v) return { ok: false, msg: { ar: 'البريد الإلكتروني مطلوب', en: 'Email is required', fr: "L'e-mail est requis" } };
    if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(v)) {
      return { ok: false, msg: { ar: 'صيغة البريد غير صحيحة', en: 'Invalid email', fr: 'E-mail invalide' } };
    }
    return { ok: true, value: v };
  },
  password(value, isRegister) {
    if (!value) return { ok: false, msg: { ar: 'كلمة المرور مطلوبة', en: 'Password required', fr: 'Requis' } };
    if (value.length < 8) return { ok: false, msg: { ar: '8 أحرف على الأقل', en: 'Min 8 characters', fr: 'Min 8' } };
    if (isRegister) {
      if (!/[a-zA-Z\u0600-\u06FF]/.test(value)) return { ok: false, msg: { ar: 'يجب حرف واحد', en: 'Need a letter', fr: 'Lettre' } };
      if (!/[0-9]/.test(value)) return { ok: false, msg: { ar: 'يجب رقم واحد', en: 'Need a number', fr: 'Chiffre' } };
    }
    return { ok: true };
  },
  confirmPassword(password, confirm) {
    if (!confirm) return { ok: false, msg: { ar: 'التأكيد مطلوب', en: 'Confirm required', fr: 'Confirmation' } };
    if (password !== confirm) return { ok: false, msg: { ar: 'غير متطابقتين', en: 'Do not match', fr: 'Différents' } };
    return { ok: true };
  },
  terms(checked) {
    if (!checked) return { ok: false, msg: { ar: 'وافق على الشروط', en: 'Accept terms', fr: 'Accepter' } };
    return { ok: true };
  }
};

function msg(obj) {
  const lang = (typeof currentLang !== 'undefined' ? currentLang : localStorage.getItem('lang')) || 'ar';
  return obj[lang] || obj.ar || obj.en || '';
}

function showFieldError(inputEl, message) {
  clearFieldError(inputEl);
  if (!inputEl) return;
  inputEl.classList.add('input-error');
  const err = document.createElement('div');
  err.className = 'field-error';
  err.textContent = message;
  inputEl.parentElement.appendChild(err);
}
function clearFieldError(inputEl) {
  if (!inputEl) return;
  inputEl.classList.remove('input-error');
  const e = inputEl.parentElement && inputEl.parentElement.querySelector('.field-error');
  if (e) e.remove();
}
function clearAllErrors(form) {
  form.querySelectorAll('.input-error').forEach(el => clearFieldError(el));
  form.querySelectorAll('.form-error-banner, .form-success-banner').forEach(el => el.remove());
}
function showFormError(form, message) {
  let b = form.querySelector('.form-error-banner');
  if (!b) { b = document.createElement('div'); b.className = 'form-error-banner'; form.prepend(b); }
  b.textContent = message;
}
function showFormSuccess(form, message) {
  let b = form.querySelector('.form-success-banner');
  if (!b) { b = document.createElement('div'); b.className = 'form-success-banner'; form.prepend(b); }
  b.textContent = message;
}

async function registerUser({ name, email, password, confirm, terms }) {
  if (typeof apiFetch === 'function' && typeof apiHealth === 'function') {
    try {
      if (await apiHealth()) {
        const nameV = validators.name(name); if (!nameV.ok) return { ok: false, field: 'name', error: msg(nameV.msg) };
        const emailV = validators.email(email); if (!emailV.ok) return { ok: false, field: 'email', error: msg(emailV.msg) };
        const passV = validators.password(password, true); if (!passV.ok) return { ok: false, field: 'password', error: msg(passV.msg) };
        const confV = validators.confirmPassword(password, confirm); if (!confV.ok) return { ok: false, field: 'confirm', error: msg(confV.msg) };
        const termsV = validators.terms(terms); if (!termsV.ok) return { ok: false, field: 'terms', error: msg(termsV.msg) };
        const data = await apiFetch('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email: emailV.value, password, full_name: name.trim() })
        });
        setApiSession(data.access_token, data.user);
        return { ok: true, user: { id: data.user.id, name: data.user.full_name, email: data.user.email, role: data.user.role }, backend: true };
      }
    } catch (e) {
      return { ok: false, field: null, error: e.message || 'فشل التسجيل عبر الخادم' };
    }
  }

  const nameV = validators.name(name); if (!nameV.ok) return { ok: false, field: 'name', error: msg(nameV.msg) };
  const emailV = validators.email(email); if (!emailV.ok) return { ok: false, field: 'email', error: msg(emailV.msg) };
  const passV = validators.password(password, true); if (!passV.ok) return { ok: false, field: 'password', error: msg(passV.msg) };
  const confV = validators.confirmPassword(password, confirm); if (!confV.ok) return { ok: false, field: 'confirm', error: msg(confV.msg) };
  const termsV = validators.terms(terms); if (!termsV.ok) return { ok: false, field: 'terms', error: msg(termsV.msg) };
  await ensureAdminAccount();
  const users = getUsers();
  if (users.some(u => u.email === emailV.value)) return { ok: false, field: 'email', error: msg({ ar: 'البريد مسجّل مسبقاً', en: 'Already registered', fr: 'Déjà utilisé' }) };
  if (emailV.value === 'admin@maarisk.org') return { ok: false, field: 'email', error: msg({ ar: 'بريد محجوز', en: 'Reserved', fr: 'Réservé' }) };
  const user = {
    id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name: name.trim(), email: emailV.value, passwordHash: await hashPassword(password),
    role: 'user', active: true, createdAt: new Date().toISOString()
  };
  users.push(user); saveUsers(users); setSession(user);
  return { ok: true, user };
}

async function loginUser({ email, password }) {
  // بدون خادم: مسار محلي أولاً (file:// أو عند تعذر API)
  const preferLocal = (typeof location !== 'undefined' && location.protocol === 'file:') ||
    localStorage.getItem('maarisk_force_local_auth') === '1';

  if (!preferLocal && typeof apiFetch === 'function' && typeof apiHealth === 'function') {
    try {
      const healthy = await Promise.race([
        apiHealth(),
        new Promise(resolve => setTimeout(() => resolve(false), 800))
      ]);
      if (healthy) {
        try {
          const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
          });
          setApiSession(data.access_token, data.user);
          return {
            ok: true,
            user: {
              id: data.user.id,
              name: data.user.full_name || data.user.name || 'Admin',
              email: data.user.email,
              role: data.user.role,
              must_change_password: !!(data.must_change_password || data.user.must_change_password)
            },
            backend: true
          };
        } catch (e) {
          console.warn('API login failed, try local', e.message);
        }
      }
    } catch (e) {
      console.warn('API unavailable, local auth', e);
    }
  }
  // ---- Local auth (يعمل بدون سيرفر) ----

  const emailV = validators.email(email); if (!emailV.ok) return { ok: false, field: 'email', error: msg(emailV.msg) };
  const passV = validators.password(password, false); if (!passV.ok) return { ok: false, field: 'password', error: msg(passV.msg) };
  await ensureAdminAccount();
  const generic = msg({ ar: 'البريد أو كلمة المرور غير صحيحة', en: 'Invalid email or password', fr: 'Identifiants incorrects' });
  const users = getUsers();
  const user = users.find(u => u.email === emailV.value);
  if (!user) return { ok: false, field: null, error: generic };
  if (user.active === false) return { ok: false, field: null, error: msg({ ar: 'الحساب ملغى الاشتراك', en: 'Account deactivated', fr: 'Compte désactivé' }) };
  const passwordHash = await hashPassword(password);
  const isAdminUser = user.role === 'admin' || user.email === 'admin@maarisk.org';
  if (isAdminUser) {
    const initialHash = await hashPassword('Admin@123');
    const adminHash = await getAdminPassHash();
    const ok =
      passwordHash === user.passwordHash ||
      passwordHash === adminHash ||
      (password === 'Admin@123' && (user.passwordHash === initialHash || !localStorage.getItem(ADMIN_PASS_KEY + '_changed')));
    if (ok) {
      // مزامنة الهاش إن دخل بالابتدائية ولم تُعلَّم _changed
      if (password === 'Admin@123' && !localStorage.getItem(ADMIN_PASS_KEY + '_changed')) {
        await setAdminPassHash('Admin@123');
        user.passwordHash = initialHash;
      }
      user.name = 'Admin';
      user.role = 'admin';
      user.active = true;
      user.must_change_password = (password === 'Admin@123' && !localStorage.getItem(ADMIN_PASS_KEY + '_changed'));
      saveUsers(users);
      setSession(user);
      return { ok: true, user };
    }
    return { ok: false, field: null, error: generic };
  }
  if (passwordHash !== user.passwordHash) {
    return { ok: false, field: null, error: generic };
  }
  setSession(user);
  return { ok: true, user };
}

function logoutUser() {
  clearSession();
  window.location.href = (window.location.pathname.includes('/pages/') ? '../' : '') + 'index.html';
}

async function changePassword(userId, currentPassword, newPassword, confirm) {
  const preferLocal = (typeof location !== 'undefined' && location.protocol === 'file:') ||
    localStorage.getItem('maarisk_force_local_auth') === '1' ||
    !localStorage.getItem('maarisk_api_token');
  if (!preferLocal && typeof apiFetch === 'function' && localStorage.getItem('maarisk_api_token')) {
    try {
      const data = await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirm
        })
      });
      if (data.access_token && data.user) setApiSession(data.access_token, data.user);
      return { ok: true, backend: true, message: data.message };
    } catch (e) {
      console.warn('API change-password failed, local', e.message);
    }
  }

  const passV = validators.password(newPassword, true);
  if (!passV.ok) return { ok: false, error: msg(passV.msg) };
  const confV = validators.confirmPassword(newPassword, confirm);
  if (!confV.ok) return { ok: false, error: msg(confV.msg) };
  if (!currentPassword) {
    return { ok: false, error: msg({ ar: 'أدخل كلمة المرور الحالية', en: 'Enter current password', fr: 'Requis' }) };
  }
  if (currentPassword === newPassword) {
    return { ok: false, error: msg({ ar: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية', en: 'New password must differ', fr: 'Doit différer' }) };
  }

  const users = getUsers();
  let idx = users.findIndex(u => u.id === userId);
  if (idx === -1) idx = users.findIndex(u => u.role === 'admin' || u.email === 'admin@maarisk.org');
  if (idx === -1) return { ok: false, error: msg({ ar: 'المستخدم غير موجود', en: 'Not found', fr: 'Introuvable' }) };

  const isAdminUser = users[idx].role === 'admin' || users[idx].email === 'admin@maarisk.org';
  const currentHash = await hashPassword(currentPassword);

  if (isAdminUser) {
    const adminHash = await getAdminPassHash();
    const userHash = users[idx].passwordHash;
    const okCurrent = (currentHash === adminHash) || (currentHash === userHash) || (currentPassword === 'Admin@123' && !localStorage.getItem(ADMIN_PASS_KEY + '_changed'));
    if (!okCurrent) {
      return { ok: false, error: msg({ ar: 'كلمة المرور الحالية غير صحيحة', en: 'Wrong current password', fr: 'Incorrect' }) };
    }
    await setAdminPassHash(newPassword);
    localStorage.setItem(ADMIN_PASS_KEY + '_changed', '1');
    users[idx].passwordHash = await hashPassword(newPassword);
    users[idx].name = 'Admin';
    users[idx].role = 'admin';
    users[idx].active = true;
    users[idx].must_change_password = false;
    saveUsers(users);
    const session = getSession();
    if (session) {
      const u = users[idx];
      setSession(u);
    }
    return { ok: true, message: 'تم تغيير كلمة المرور بنجاح' };
  }

  if (users[idx].passwordHash !== currentHash) {
    return { ok: false, error: msg({ ar: 'كلمة المرور الحالية غير صحيحة', en: 'Wrong current password', fr: 'Incorrect' }) };
  }
  users[idx].passwordHash = await hashPassword(newPassword);
  saveUsers(users);
  return { ok: true };
}

function deactivateUser(userId) {
  try {
    if (typeof requirePermission === 'function') requirePermission(PERM.MANAGE_USERS);
  } catch (e) {
    return { ok: false, error: e.message };
  }
  const session = getSession();
  if (!session || session.role !== 'admin') return { ok: false, error: 'Unauthorized' };
  if (userId === session.id) return { ok: false, error: msg({ ar: 'لا يمكن إلغاء حسابك', en: 'Cannot deactivate self', fr: 'Impossible' }) };
  const users = getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return { ok: false, error: 'Not found' };
  if (users[idx].role === 'admin') return { ok: false, error: msg({ ar: 'لا يمكن إلغاء مدير', en: 'Cannot deactivate admin', fr: 'Impossible' }) };
  users[idx].active = false; saveUsers(users); return { ok: true };
}

function reactivateUser(userId) {
  try {
    if (typeof requirePermission === 'function') requirePermission(PERM.MANAGE_USERS);
  } catch (e) {
    return { ok: false, error: e.message };
  }
  const session = getSession();
  if (!session || session.role !== 'admin') return { ok: false, error: 'Unauthorized' };
  const users = getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return { ok: false, error: 'Not found' };
  users[idx].active = true; saveUsers(users); return { ok: true };
}

function passwordStrength(password) {
  let score = 0;
  if (!password) return { score: 0, label: { ar: '', en: '', fr: '' } };
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  const labels = [
    { ar: 'ضعيفة جداً', en: 'Very weak', fr: 'Très faible' },
    { ar: 'ضعيفة', en: 'Weak', fr: 'Faible' },
    { ar: 'متوسطة', en: 'Medium', fr: 'Moyen' },
    { ar: 'جيدة', en: 'Good', fr: 'Bon' },
    { ar: 'قوية', en: 'Strong', fr: 'Fort' }
  ];
  return { score: Math.min(score, 4), label: labels[Math.min(score, 4)] };
}

function updateAuthUI() {
  const session = getSession();
  document.querySelectorAll('[data-auth="guest"]').forEach(el => { el.style.display = session ? 'none' : ''; });
  document.querySelectorAll('[data-auth="user"]').forEach(el => { el.style.display = session ? '' : 'none'; });
  document.querySelectorAll('[data-auth="admin"]').forEach(el => { el.style.display = (session && session.role === 'admin') ? '' : 'none'; });
  document.querySelectorAll('[data-auth-name]').forEach(el => { if (session) el.textContent = session.name; });
  // روابط الوحدات التشغيلية للزائر → تسجيل الدخول
  document.querySelectorAll('[data-requires-auth]').forEach(el => {
    if (session) {
      if (el.dataset.authHref) el.setAttribute('href', el.dataset.authHref);
      return;
    }
    if (!el.dataset.authHref) el.dataset.authHref = el.getAttribute('href') || '';
    const inPages = (window.location.pathname || '').includes('/pages/');
    const login = inPages ? 'login.html' : 'pages/login.html';
    const ret = encodeURIComponent(el.dataset.authHref || '');
    el.setAttribute('href', login + '?return=' + ret);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // بدون سيرفر: فعّل المصادقة المحلية تلقائياً
    if (location.protocol === 'file:') localStorage.setItem('maarisk_force_local_auth', '1');
    else {
      // إن لم يستجب الخادم خلال 600ms نستخدم المحلي
      if (typeof apiHealth === 'function') {
        Promise.race([apiHealth(), new Promise(r => setTimeout(() => r(false), 600))]).then(ok => {
          if (!ok) localStorage.setItem('maarisk_force_local_auth', '1');
          else localStorage.removeItem('maarisk_force_local_auth');
        });
      } else localStorage.setItem('maarisk_force_local_auth', '1');
    }
    await ensureAdminAccount();
  } catch (e) { console.warn(e); }
  // مزامنة اسم/دور المدير في الجلسة الحالية
  try {
    const s = getSession();
    if (s && (s.role === 'admin' || s.email === 'admin@maarisk.org')) {
      const admin = getUsers().find(u => u.email === 'admin@maarisk.org' || u.id === 'u_admin_default');
      if (admin) setSession(admin);
    }
  } catch (e) {}
  updateAuthUI();

  document.querySelectorAll('[data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', e => { e.preventDefault(); logoutUser(); });
  });

  const regForm = document.getElementById('register-form');
  if (regForm) {
    const passInput = document.getElementById('reg-password');
    const strengthBar = document.getElementById('password-strength');
    const strengthText = document.getElementById('password-strength-text');
    if (passInput && strengthBar) {
      passInput.addEventListener('input', () => {
        const { score, label } = passwordStrength(passInput.value);
        strengthBar.style.width = ((score + 1) * 20) + '%';
        strengthBar.className = 'strength-bar strength-' + score;
        if (strengthText) strengthText.textContent = msg(label);
      });
    }
    regForm.addEventListener('submit', async e => {
      e.preventDefault();
      clearAllErrors(regForm);
      const submitBtn = regForm.querySelector('[type="submit"]');
      const original = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> ...';
      try {
        const result = await registerUser({
          name: document.getElementById('reg-name').value,
          email: document.getElementById('reg-email').value,
          password: document.getElementById('reg-password').value,
          confirm: document.getElementById('reg-confirm').value,
          terms: document.getElementById('reg-terms').checked
        });
        if (!result.ok) {
          if (result.field) {
            const input = document.getElementById('reg-' + result.field) || document.getElementById('reg-terms');
            if (input) showFieldError(input, result.error);
          }
          showFormError(regForm, result.error);
          return;
        }
        showFormSuccess(regForm, msg({ ar: 'تم إنشاء الحساب!', en: 'Created!', fr: 'Créé !' }));
        setTimeout(() => { window.location.href = 'data.html'; }, 700);
      } catch (err) {
        showFormError(regForm, 'خطأ: ' + (err.message || err));
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = original;
      }
    });
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      clearAllErrors(loginForm);
      const submitBtn = loginForm.querySelector('[type="submit"]');
      const original = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> ...';
      try {
        const result = await loginUser({
          email: document.getElementById('login-email').value,
          password: document.getElementById('login-password').value
        });
        if (!result.ok) {
          if (result.field) {
            const input = document.getElementById('login-' + result.field);
            if (input) showFieldError(input, result.error);
          }
          showFormError(loginForm, result.error);
          return;
        }
        showFormSuccess(loginForm, msg({ ar: 'تم الدخول!', en: 'OK', fr: 'OK' }));
        let dest = result.user.role === 'admin' ? 'admin.html' : 'data.html';
        if (result.user.must_change_password) dest = 'admin.html#password';
        else {
          const q = new URLSearchParams(window.location.search);
          const ret = q.get('return');
          if (ret) {
            let safe = decodeURIComponent(ret);
            if (/admin/i.test(safe) && result.user.role !== 'admin') safe = 'data.html';
            // تطبيع المسار حسب موقع login
            if (safe.startsWith('pages/') && /\/pages\//.test(window.location.pathname)) {
              safe = safe.replace(/^pages\//, '');
            }
            dest = safe;
          }
        }
        setTimeout(() => { window.location.href = dest; }, 500);
      } catch (err) {
        showFormError(loginForm, 'خطأ: ' + (err.message || err));
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = original;
      }
    });
  }

  document.querySelectorAll('#register-form input, #login-form input').forEach(input => {
    input.addEventListener('input', () => clearFieldError(input));
  });
});
