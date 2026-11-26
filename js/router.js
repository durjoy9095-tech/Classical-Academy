// Hash router + layout shells (public / student / admin).
import { html, put, icon, logoMark, $, $$, errMsg, skeleton } from './lib.js';
import { state, role, isStaff, signOut } from './db.js';

const routes = [];
export function route(pattern, handler, opts = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:[a-zA-Z]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '/?$');
  routes.push({ re, keys, handler, opts });
}
export const navigate = (path) => { if (location.hash === '#' + path) render(); else location.hash = '#' + path; };

let token = 0, shellKey = '';
const app = () => document.getElementById('app');

export const STUDENT_NAV = [
  { to: '/home', label: 'হোম', ic: 'home', match: /^\/home/ },
  { to: '/courses', label: 'কোর্স', ic: 'courses', match: /^\/course/ },
  { to: '/store', label: 'স্টোর', ic: 'store', match: /^\/(store|cart|order)/ },
  { to: '/library', label: 'লাইব্রেরি', ic: 'library', match: /^\/library/ },
  { to: '/exams', label: 'পরীক্ষা', ic: 'exam', match: /^\/(exams|exam|result)/ },
  { to: '/profile', label: 'প্রোফাইল', ic: 'user', match: /^\/profile/ },
];

export const ADMIN_NAV = [
  { to: '/admin', label: 'ড্যাশবোর্ড', ic: 'grid', roles: ['super_admin', 'admin', 'moderator', 'teacher'] },
  { to: '/admin/users', label: 'ব্যবহারকারী', ic: 'users', roles: ['super_admin', 'admin'] },
  { to: '/admin/teachers', label: 'শিক্ষক', ic: 'user', roles: ['super_admin', 'admin'] },
  { to: '/admin/subjects', label: 'বিষয়', ic: 'tag', roles: ['super_admin', 'admin'] },
  { to: '/admin/courses', label: 'কোর্স', ic: 'courses', roles: ['super_admin', 'admin', 'teacher'] },
  { to: '/admin/exams', label: 'পরীক্ষা', ic: 'exam', roles: ['super_admin', 'admin', 'teacher'] },
  { to: '/admin/results', label: 'ফলাফল', ic: 'chart', roles: ['super_admin', 'admin', 'teacher'] },
  { to: '/admin/books', label: 'লাইব্রেরি বই', ic: 'library', roles: ['super_admin', 'admin'] },
  { to: '/admin/products', label: 'স্টোর পণ্য', ic: 'store', roles: ['super_admin', 'admin'] },
  { to: '/admin/orders', label: 'অর্ডার', ic: 'receipt', roles: ['super_admin', 'admin'] },
  { to: '/admin/payments', label: 'পেমেন্ট', ic: 'tag', roles: ['super_admin', 'admin'] },
  { to: '/admin/announcements', label: 'ঘোষণা', ic: 'bell', roles: ['super_admin', 'admin', 'moderator'] },
  { to: '/admin/support', label: 'সাপোর্ট ও ডাউট', ic: 'chat', roles: ['super_admin', 'admin', 'moderator', 'teacher'] },
  { to: '/admin/welcome', label: 'ওয়েলকাম পেজ', ic: 'globe', roles: ['super_admin'] },
  { to: '/admin/settings', label: 'সাইট সেটিংস', ic: 'settings', roles: ['super_admin'] },
];
export const canAdmin = (path) => {
  const item = ADMIN_NAV.find((n) => n.to === path);
  return !!item && item.roles.includes(role());
};

const FOOT = html`<footer class="site-foot">© ২০২৬ Classical Academy. All rights reserved.</footer>`;

function buildShell(layout) {
  const a = app();
  if (layout === 'student') {
    put(a, html`
      <div class="shell student">
        <header class="topbar"><a href="#/home" class="brand">${logoMark()}<span>ক্লাসিক্যাল একাডেমি</span></a>
          <div class="top-actions">
            ${isStaff() ? html`<a class="chip-link" href="#/admin">${icon('settings', 18)}<span>প্যানেল</span></a>` : ''}
            <a class="icon-btn" href="#/cart" aria-label="কার্ট">${icon('cart', 20)}</a>
          </div></header>
        <main class="view" data-view></main>
        ${FOOT}
        <nav class="bottom-nav" aria-label="প্রধান নেভিগেশন">
          ${STUDENT_NAV.map((n) => html`<a href="#${n.to}" data-nav="${n.to}">${icon(n.ic, 24)}<span>${n.label}</span></a>`)}
        </nav>
      </div>`);
  } else if (layout === 'admin') {
    const items = ADMIN_NAV.filter((n) => n.roles.includes(role()));
    put(a, html`
      <div class="shell admin">
        <aside class="side" id="side">
          <a href="#/admin" class="brand">${logoMark()}<span>অ্যাডমিন প্যানেল</span></a>
          <nav>${items.map((n) => html`<a href="#${n.to}" data-nav="${n.to}">${icon(n.ic, 20)}<span>${n.label}</span></a>`)}</nav>
          <div class="side-foot"><a href="#/home">${icon('home', 18)} শিক্ষার্থী ভিউ</a>
            <button id="adm-out" class="linklike">${icon('logout', 18)} লগআউট</button></div>
        </aside>
        <div class="side-scrim" id="scrim"></div>
        <div class="admin-main">
          <header class="topbar"><button class="icon-btn" id="burger" aria-label="মেনু">${icon('menu', 22)}</button>
            <strong>Classical Academy</strong><span class="role-pill">${role()}</span></header>
          <main class="view" data-view></main>
          ${FOOT}
        </div>
      </div>`);
    const side = $('#side'), scrim = $('#scrim');
    $('#burger').addEventListener('click', () => { side.classList.toggle('open'); scrim.classList.toggle('open'); });
    scrim.addEventListener('click', () => { side.classList.remove('open'); scrim.classList.remove('open'); });
    $$('#side nav a').forEach((l) => l.addEventListener('click', () => { side.classList.remove('open'); scrim.classList.remove('open'); }));
    $('#adm-out').addEventListener('click', async () => { await signOut(); navigate('/'); });
  } else {
    put(a, html`<div class="shell public"><main class="view" data-view></main></div>`);
  }
}

function updateNav(path) {
  $$('[data-nav]').forEach((l) => {
    const to = l.dataset.nav;
    const stu = STUDENT_NAV.find((n) => n.to === to);
    const on = stu ? stu.match.test(path) : (to === '/admin' ? path === '/admin' : path.startsWith(to));
    l.classList.toggle('active', on);
    if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
  });
}

export async function render() {
  const rawPath = location.hash.slice(1) || '/';
  const [path, qs] = rawPath.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  let found = null, params = {};
  for (const rt of routes) {
    const m = path.match(rt.re);
    if (m) { found = rt; rt.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); break; }
  }
  if (!found) { found = { handler: notFound, opts: { layout: 'public' } }; }
  const o = found.opts;

  if (o.auth && !state.session) return navigate('/login?next=' + encodeURIComponent(rawPath));
  if (o.auth && state.session && !state.profile) {
    put(app(), html`<div class="center-screen"><div class="spin lg"></div></div>`); shellKey = '';
    const { loadProfile } = await import('./db.js'); await loadProfile();
    if (!state.profile) { put(app(), html`<div class="center-screen"><p>প্রোফাইল লোড করা যায়নি।</p><button class="btn primary" onclick="location.reload()">রিলোড</button></div>`); return; }
  }
  if (o.auth && state.profile?.role === 'student' && !state.profile.class_level && path !== '/complete-profile')
    return navigate('/complete-profile');
  if (o.roles && !o.roles.includes(role())) { toastDenied(); return navigate('/home'); }
  if (o.guestOnly && state.session) return navigate(isStaff() && o.adminHome ? '/admin' : '/home');

  const t = ++token;
  const key = o.layout + ':' + (o.layout === 'admin' ? role() : isStaff());
  if (key !== shellKey) { buildShell(o.layout); shellKey = key; }
  updateNav(path);
  const view = $('[data-view]');
  put(view, skeleton());
  view.classList.remove('page-in');
  try {
    await found.handler({ root: view, params, query, path, stale: () => t !== token });
  } catch (e) {
    console.error(e);
    if (t === token) {
      put(view, html`<div class="card pad center"><h3>দুঃখিত, লোড করা যায়নি</h3><p class="muted">${errMsg(e)}</p>
        <button class="btn primary" id="retry">আবার চেষ্টা করুন</button></div>`);
      $('#retry')?.addEventListener('click', render);
    }
  }
  if (t === token) { void view.offsetWidth; view.classList.add('page-in'); if (!query.keep) window.scrollTo(0, 0); }
}

function toastDenied() { import('./lib.js').then((m) => m.toast('এই পেজে প্রবেশের অনুমতি নেই।', 'err')); }

async function notFound({ root }) {
  put(root, html`<div class="center-screen"><h2>৪০৪</h2><p class="muted">পেজটি খুঁজে পাওয়া যায়নি।</p>
    <a class="btn primary" href="#/">হোমে ফিরুন</a></div>`);
}

export function resetShell() { shellKey = ''; }
export function startRouter() {
  window.addEventListener('hashchange', render);
  render();
}
