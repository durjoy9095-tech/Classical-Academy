// Shared helpers: safe HTML templating, formatting, labels, icons, toast, modal.
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => MAP[c]);

class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(String(s ?? ''));
const r = (v) => v instanceof Raw ? v.s : Array.isArray(v) ? v.map(r).join('')
  : (v === false || v == null) ? '' : esc(v);
/** Tagged template: every interpolated value is HTML-escaped unless it is html`` / raw(). */
export const html = (strs, ...vals) =>
  new Raw(strs.reduce((o, s, i) => o + s + (i < vals.length ? r(vals[i]) : ''), ''));
export const put = (el, v) => { el.innerHTML = r(v); };

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function safeUrl(u) {
  const s = String(u ?? '').trim();
  return /^(https?:\/\/|\/|#)/i.test(s) ? s : '';
}

// ---------- Bengali formatting ----------
const D = '০১২৩৪৫৬৭৮৯';
export const bn = (v) => String(v ?? '').replace(/\d/g, (d) => D[d]);
export const money = (n) => Number(n) > 0
  ? '৳' + bn(Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })) : 'বিনামূল্যে';
export const num = (n) => bn(Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 }));
export const fmtDate = (d) => d ? bn(new Date(d).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })) : '—';
export const fmtTime = (d) => d ? bn(new Date(d).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })) : '';
export const fmtDT = (d) => d ? `${fmtDate(d)}, ${fmtTime(d)}` : '—';
export const toLocalInput = (d) => {
  if (!d) return '';
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};
export const fromLocalInput = (v) => v ? new Date(v).toISOString() : null;

// ---------- Labels ----------
export const CLASS_LABELS = { 6: 'ষষ্ঠ শ্রেণি', 7: 'সপ্তম শ্রেণি', 8: 'অষ্টম শ্রেণি', 9: 'নবম শ্রেণি', 10: 'দশম শ্রেণি' };
export const classLabel = (c) => CLASS_LABELS[c] || '—';
export const GROUPS = { science: 'বিজ্ঞান', humanities: 'মানবিক', business: 'ব্যবসায় শিক্ষা' };
export const groupLabel = (g) => GROUPS[g] || '';
export const ROLES = { super_admin: 'সুপার অ্যাডমিন', admin: 'অ্যাডমিন', moderator: 'মডারেটর', teacher: 'শিক্ষক', student: 'শিক্ষার্থী' };
export const PRODUCT_KINDS = { book: 'বই', pdf: 'পিডিএফ বই', notes: 'স্টাডি নোট', slides: 'অনলাইন স্লাইড', material: 'শিক্ষা উপকরণ', course: 'প্রিমিয়াম কোর্স' };
export const EXAM_KINDS = { mcq: 'এমসিকিউ', written: 'লিখিত', mixed: 'মিশ্র' };
export const ORDER_STATUS = { pending: 'যাচাই চলছে', paid: 'পরিশোধিত', cancelled: 'বাতিল' };
export const PAY_METHODS = { bkash: 'বিকাশ', nagad: 'নগদ', rocket: 'রকেট', other: 'অন্যান্য' };

/** Bangladesh secondary-school grading. */
export function gradeOf(pct) {
  if (pct >= 80) return { g: 'A+', gp: '৫.০০' };
  if (pct >= 70) return { g: 'A', gp: '৪.০০' };
  if (pct >= 60) return { g: 'A−', gp: '৩.৫০' };
  if (pct >= 50) return { g: 'B', gp: '৩.০০' };
  if (pct >= 40) return { g: 'C', gp: '২.০০' };
  if (pct >= 33) return { g: 'D', gp: '১.০০' };
  return { g: 'F', gp: '০.০০' };
}

// ---------- Errors ----------
export function errMsg(e) {
  const m = String(e?.message || e || '');
  const table = [
    [/Invalid login credentials/i, 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।'],
    [/Email not confirmed/i, 'আপনার ইমেইল এখনো যাচাই করা হয়নি। ইনবক্সে পাঠানো লিঙ্কে ক্লিক করুন।'],
    [/User already registered|already been registered/i, 'এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট খোলা আছে।'],
    [/Password should be at least/i, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'],
    [/rate limit|too many requests|after \d+ seconds/i, 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।'],
    [/duplicate key|already exists/i, 'এই তথ্য ইতিমধ্যে আছে (ডুপ্লিকেট)।'],
    [/row-level security|permission denied|not allowed|42501/i, 'এই কাজটি করার অনুমতি আপনার নেই।'],
    [/violates foreign key/i, 'এটি অন্য তথ্যের সাথে যুক্ত থাকায় পরিবর্তন করা যাচ্ছে না।'],
    [/violates check constraint/i, 'প্রদত্ত তথ্য সঠিক নয়। ফর্মটি আবার দেখুন।'],
    [/Failed to fetch|NetworkError|network/i, 'ইন্টারনেট সংযোগ পরীক্ষা করুন।'],
    [/exam not started/i, 'পরীক্ষা এখনো শুরু হয়নি।'],
    [/exam ended/i, 'পরীক্ষার সময় শেষ হয়ে গেছে।'],
    [/exam not available/i, 'পরীক্ষাটি পাওয়া যাচ্ছে না।'],
    [/already submitted/i, 'উত্তর ইতিমধ্যে জমা দেওয়া হয়েছে।'],
    [/cart empty/i, 'কার্ট খালি।'],
    [/payment info required/i, 'পেমেন্ট মাধ্যম ও ট্রানজেকশন আইডি দিন।'],
    [/same password/i, 'নতুন পাসওয়ার্ড আগেরটির থেকে আলাদা হতে হবে।'],
    [/Bucket not found/i, 'স্টোরেজ বাকেট পাওয়া যায়নি। schema.sql চালানো হয়েছে কি?'],
  ];
  for (const [re, bnText] of table) if (re.test(m)) return bnText;
  return m || 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।';
}

// ---------- Icons ----------
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  courses: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
  store: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  library: '<path d="M4 4h5v16H4z"/><path d="M10 4h5v16h-5z"/><path d="m16.5 5.5 4 1-3.5 13.5-4-1z"/>',
  exam: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="m9 14 2 2 4-4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  device: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8"/><path d="M12 17h.01"/>',
  download: '<path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 20h16"/>',
  fingerprint: '<path d="M12 11v3a6 6 0 0 1-1 3.5M8 14a4 4 0 0 1 8 0c0 3-.5 5-1.5 6.5M5 11a7 7 0 0 1 14 0v2M8.5 20.5C9.5 19 10 17 10 14"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13v1.5M15 13v1.5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  logout: '<path d="M10 4H5v16h5"/><path d="M15 8l4 4-4 4M19 12H9"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a7 7 0 0 1 4 6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M2 3h3l2.5 12H18l2-8H6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  pin: '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
  live: '<circle cx="12" cy="12" r="2.5"/><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10"/>',
  offline: '<path d="M12 3v12m0 0-4-4m4 4 4-4"/><rect x="4" y="17" width="16" height="4" rx="1"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};
export const icon = (name, size = 22) => raw(
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`);

export const logoMark = (cls = '') => raw(`<span class="logo-mark ${cls}" aria-label="Classical Academy">CA</span>`);

// ---------- Toast / Modal / Confirm ----------
export function toast(msg, type = 'ok') {
  const box = $('#toasts'); if (!box) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`; t.setAttribute('role', 'status'); t.textContent = msg;
  box.append(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3700);
}

export function openModal(content, { wide = false, onMount } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${r(content)}</div>`;
  const close = () => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 180); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(wrap);
  $$('[data-close]', wrap).forEach((b) => b.addEventListener('click', close));
  onMount?.(wrap.firstElementChild, close);
  return close;
}

export function confirmBox(message, { yes = 'হ্যাঁ, নিশ্চিত', no = 'বাতিল', danger = true } = {}) {
  return new Promise((resolve) => {
    const close = openModal(html`
      <p class="confirm-text">${message}</p>
      <div class="row end gap"><button class="btn ghost" data-no>${no}</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${yes}</button></div>`, {
      onMount: (m) => {
        $('[data-yes]', m).addEventListener('click', () => { close(); resolve(true); });
        $('[data-no]', m).addEventListener('click', () => { close(); resolve(false); });
      },
    });
  });
}

// ---------- Misc ----------
export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const formObj = (form) => Object.fromEntries(new FormData(form).entries());
export const skeleton = (n = 3) => html`<div class="skel-wrap">${Array.from({ length: n }, () => html`<div class="skel"></div>`)}</div>`;
export const empty = (text, ic = 'file') => html`<div class="empty">${icon(ic, 40)}<p>${text}</p></div>`;

export function ytEmbed(url) {
  const u = safeUrl(url); if (!u) return null;
  try {
    const x = new URL(u); let id = null;
    if (x.hostname.includes('youtu.be')) id = x.pathname.slice(1);
    else if (x.hostname.includes('youtube.com')) {
      id = x.searchParams.get('v') || x.pathname.match(/\/(embed|live|shorts)\/([\w-]{6,})/)?.[2] || null;
    }
    return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
  } catch { return null; }
}

export function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'অজানা';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'ব্রাউজার';
  return `${br} · ${os}`;
}

export function btnBusy(btn, busy, text) {
  if (!btn) return;
  if (busy) { btn.dataset.t = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${text || ''}`; }
  else { btn.disabled = false; if (btn.dataset.t) btn.innerHTML = btn.dataset.t; }
}

/** Unwrap a Supabase {data,error} result (throws on error). */
export const must = (res) => { if (res.error) throw res.error; return res.data; };
