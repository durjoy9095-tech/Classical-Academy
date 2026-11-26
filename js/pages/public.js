// Public pages: welcome, login, register, forgot/reset password, complete profile, setup guide.
import { html, put, icon, logoMark, $, $$, errMsg, toast, formObj, btnBusy, safeUrl, ytEmbed, fmtDate, classLabel, GROUPS, CLASS_LABELS, debounce } from '../lib.js';
import { sb, state, isStaff, loadProfile, getSetting, logActivity, registerDevice } from '../db.js';
import { ENABLE_GOOGLE } from '../config.js';
import { navigate } from '../router.js';
import { courseCard, teacherCard } from '../components.js';

const FOOTER = html`<footer class="footer-dark">© ২০২৬ Classical Academy. All rights reserved.</footer>`;
const enDigits = (s) => String(s).replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d));
const BD_MOBILE = /^(?:\+?88)?01[3-9]\d{8}$/;

// ------------------------------------------------------------------ setup guide
export function setupScreen({ root }) {
  put(root, html`<div class="auth-page"><div class="card auth-card pad" style="width:min(100%,640px)">
    <div class="brand-top">${logoMark('lg')}<h1>Supabase সেটআপ প্রয়োজন</h1>
      <p class="muted">অ্যাপটি এখনো আপনার Supabase প্রজেক্টের সাথে যুক্ত নয়।</p></div>
    <ol>
      <li><a href="https://supabase.com/dashboard" target="_blank" rel="noopener">supabase.com</a>-এ একটি নতুন প্রজেক্ট খুলুন।</li>
      <li><b>SQL Editor</b>-এ <code>supabase/schema.sql</code> ফাইলের পুরো লেখা পেস্ট করে <b>Run</b> দিন।</li>
      <li><b>Project Settings → API</b> থেকে <i>Project URL</i> ও <i>anon public key</i> কপি করুন।</li>
      <li><code>js/config.js</code> ফাইলে <code>SUPABASE_URL</code> ও <code>SUPABASE_ANON_KEY</code> বসিয়ে সেভ করুন।</li>
      <li>পেজ রিফ্রেশ করুন। বিস্তারিত ধাপ <code>README.md</code>-তে আছে।</li>
    </ol>
    <p class="alert info">গোপন <b>service_role</b> কী কখনো এই ফাইলে বসাবেন না।</p>
  </div></div>`);
}

// ------------------------------------------------------------------ welcome
export async function welcome({ root }) {
  const [w, courses, teachers, anns] = await Promise.all([
    getSetting('welcome'),
    sb.from('courses').select('*, teacher:teachers(full_name), subject:subjects(name)').eq('is_published', true).eq('featured', true).order('created_at', { ascending: false }).limit(6),
    sb.from('teachers').select('*').order('sort_order').order('created_at').limit(12),
    sb.from('announcements').select('*').eq('is_published', true).order('created_at', { ascending: false }).limit(5),
  ]);
  const videos = (w.video_urls || []).map(ytEmbed).filter(Boolean);
  const hasContact = w.contact_phone || w.contact_email || w.contact_address || w.support_hours;
  const dest = state.session ? (isStaff() ? '#/admin' : '#/home') : null;

  put(root, html`
    <section class="hero">
      <div class="hero-nav"><span class="brand">${logoMark()}<span>Classical Academy</span></span>
        <div class="row gap">${dest ? html`<a class="btn white sm" href="${dest}">ড্যাশবোর্ড</a>`
          : html`<a class="btn ghost sm" style="color:#fff;border-color:rgba(255,255,255,.5)" href="#/login">লগইন</a>`}</div></div>
      <div class="hero-body">
        <h1>${w.hero_title || 'ক্লাসিক্যাল একাডেমি'}</h1>
        <p>${w.hero_subtitle || ''}</p>
        <p>${w.intro || ''}</p>
        <div class="hero-cta">${dest ? html`<a class="btn white" href="${dest}">ড্যাশবোর্ডে যান ${icon('arrow', 18)}</a>`
          : html`<a class="btn white" href="#/register">রেজিস্ট্রেশন করুন ${icon('arrow', 18)}</a>
                 <a class="btn ghost" style="color:#fff;border-color:rgba(255,255,255,.6)" href="#/login">লগইন করুন</a>`}</div>
      </div>
    </section>
    <div class="pub-wrap">
      <div class="feature-row">
        ${[['video', 'রেকর্ডেড ক্লাস', 'যেকোনো সময় দেখুন'], ['live', 'লাইভ ক্লাস', 'শিক্ষকের সাথে সরাসরি'], ['library', 'ডিজিটাল লাইব্রেরি', 'বই ও নোট এক জায়গায়'], ['exam', 'অনলাইন পরীক্ষা', 'তাৎক্ষণিক ফলাফল']]
          .map(([i, t, d]) => html`<div class="card feature">${icon(i, 30)}<h3>${t}</h3><p class="muted small">${d}</p></div>`)}
      </div>

      ${courses.data?.length ? html`<section class="pub-sec"><h2>নির্বাচিত কোর্স</h2>
        <div class="grid g3">${courses.data.map((c) => courseCard(c))}</div>
        <p class="center mt"><a class="btn soft" href="#/courses">সব কোর্স দেখুন</a></p></section>` : ''}

      ${teachers.data?.length ? html`<section class="pub-sec"><h2>আমাদের শিক্ষকবৃন্দ</h2>
        <div class="grid g3">${teachers.data.map(teacherCard)}</div></section>` : ''}

      ${anns.data?.length ? html`<section class="pub-sec"><h2>শিক্ষামূলক ঘোষণা</h2><div class="list">
        ${anns.data.map((a) => html`<div class="li"><div class="ico-box">${icon('bell', 20)}</div><div class="grow">
          <h4>${a.title}</h4>${a.body ? html`<p class="muted small">${a.body}</p>` : ''}<span class="small muted">${fmtDate(a.created_at)}</span></div></div>`)}
        </div></section>` : ''}

      ${(videos.length || safeUrl(w.youtube_channel_url)) ? html`<section class="pub-sec"><h2>ভিডিও ও ইউটিউব</h2>
        ${videos.length ? html`<div class="grid g2">${videos.map((v) => html`<iframe class="player" src="${v}" title="ভিডিও" loading="lazy" allowfullscreen></iframe>`)}</div>` : ''}
        ${safeUrl(w.youtube_channel_url) ? html`<p class="center mt"><a class="btn primary" target="_blank" rel="noopener" href="${safeUrl(w.youtube_channel_url)}">${icon('youtube', 20)} আমাদের ইউটিউব চ্যানেল</a></p>` : ''}</section>` : ''}

      ${hasContact ? html`<section class="pub-sec"><h2>যোগাযোগ ও সহায়তা</h2><div class="card pad"><div class="list">
        ${w.contact_phone ? html`<div class="li"><div class="ico-box">${icon('phone', 20)}</div><div><b>ফোন</b><p>${w.contact_phone}</p></div></div>` : ''}
        ${w.contact_email ? html`<div class="li"><div class="ico-box">${icon('mail', 20)}</div><div><b>ইমেইল</b><p>${w.contact_email}</p></div></div>` : ''}
        ${w.contact_address ? html`<div class="li"><div class="ico-box">${icon('pin', 20)}</div><div><b>ঠিকানা</b><p>${w.contact_address}</p></div></div>` : ''}
        ${w.support_hours ? html`<div class="li"><div class="ico-box">${icon('clock', 20)}</div><div><b>সাপোর্ট সময়</b><p>${w.support_hours}</p></div></div>` : ''}
      </div></div></section>` : ''}
    </div>${FOOTER}`);
}

// ------------------------------------------------------------------ shared bits
const authShell = (title, sub, body) => html`<div class="auth-page"><div class="card auth-card pad">
  <div class="brand-top"><a href="#/">${logoMark('lg')}</a><h1>${title}</h1>${sub ? html`<p class="muted">${sub}</p>` : ''}</div>${body}</div></div>`;

const pwField = (name, label, auto = 'current-password') => html`<div class="field"><label for="${name}">${label}</label>
  <div class="pw-wrap"><input id="${name}" name="${name}" type="password" autocomplete="${auto}" required minlength="8">
  <button type="button" data-eye aria-label="দেখান">${icon('eye', 18)}</button></div></div>`;
const wireEyes = (root) => $$('[data-eye]', root).forEach((b) => b.addEventListener('click', () => {
  const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password';
}));
const showErr = (form, msg) => { let a = $('.alert.err', form); if (!a) { a = document.createElement('div'); a.className = 'alert err'; form.prepend(a); } a.textContent = msg; a.scrollIntoView({ block: 'nearest' }); };
const googleBtn = () => ENABLE_GOOGLE ? html`<div class="divider">অথবা</div>
  <button type="button" class="btn google block" id="google"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.1 7-10.2 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg> Google দিয়ে চালিয়ে যান</button>` : '';
const wireGoogle = (root) => $('#google', root)?.addEventListener('click', async () => {
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) toast(errMsg(error), 'err');
});
const afterLogin = (query) => navigate(query?.next && query.next.startsWith('/') ? query.next : (isStaff() ? '/admin' : '/home'));

// ------------------------------------------------------------------ login
export function login({ root, query }) {
  put(root, authShell('লগইন', 'আপনার অ্যাকাউন্টে প্রবেশ করুন', html`
    <form id="f" novalidate>
      <div class="field"><label for="email">ইমেইল</label><input id="email" name="email" type="email" autocomplete="email" required></div>
      ${pwField('password', 'পাসওয়ার্ড')}
      <div class="row between mb"><span></span><a href="#/forgot" class="small">পাসওয়ার্ড ভুলে গেছেন?</a></div>
      <button class="btn primary block" type="submit">লগইন</button>
    </form>${googleBtn()}
    <p class="center mt muted">নতুন শিক্ষার্থী? <a href="#/register"><b>রেজিস্ট্রেশন করুন</b></a></p>`));
  wireEyes(root); wireGoogle(root);
  const f = $('#f', root);
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('button[type=submit]', f); const v = formObj(f);
    if (!v.email || !v.password) return showErr(f, 'ইমেইল ও পাসওয়ার্ড দিন।');
    btnBusy(btn, true, ' অপেক্ষা করুন…');
    const { error } = await sb.auth.signInWithPassword({ email: v.email.trim(), password: v.password });
    if (error) {
      btnBusy(btn, false); showErr(f, errMsg(error));
      if (/not confirmed/i.test(error.message)) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn soft sm block mb'; b.textContent = 'যাচাই ইমেইল আবার পাঠান';
        b.onclick = async () => { const r = await sb.auth.resend({ type: 'signup', email: v.email.trim() }); toast(r.error ? errMsg(r.error) : 'ইমেইল পাঠানো হয়েছে।', r.error ? 'err' : 'ok'); };
        f.prepend(b);
      }
      return;
    }
    await loadProfile(); registerDevice(); logActivity('login');
    afterLogin(query);
  });
}

// ------------------------------------------------------------------ register
function classGroupFields(cur = {}) {
  return html`<div class="form-grid">
    <div class="field"><label for="class_level">শ্রেণি</label><select id="class_level" name="class_level" required>
      <option value="">নির্বাচন করুন</option>${Object.entries(CLASS_LABELS).map(([k, v]) => html`<option value="${k}" ${String(cur.class_level) === k ? 'selected' : ''}>${v}</option>`)}</select></div>
    <div class="field" id="group-box" ${cur.class_level >= 9 ? '' : 'hidden'}><label for="group_name">বিভাগ</label><select id="group_name" name="group_name">
      <option value="">নির্বাচন করুন</option>${Object.entries(GROUPS).map(([k, v]) => html`<option value="${k}" ${cur.group_name === k ? 'selected' : ''}>${v}</option>`)}</select></div></div>`;
}
function wireClassGroup(root) {
  const c = $('#class_level', root), box = $('#group-box', root);
  c.addEventListener('change', () => { const show = Number(c.value) >= 9; box.hidden = !show; if (!show) $('#group_name', root).value = ''; });
}
function validateProfileFields(v) {
  if ((v.full_name || '').trim().length < 2) return 'পূর্ণ নাম লিখুন।';
  if (!/^[a-z0-9_]{3,30}$/.test(v.username)) return 'ইউজারনেম ৩–৩০ অক্ষরের হতে হবে (ছোট হাতের ইংরেজি অক্ষর, সংখ্যা ও _)।';
  if (!BD_MOBILE.test(v.mobile)) return 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন 01712345678)।';
  if (!(Number(v.class_level) >= 6 && Number(v.class_level) <= 10)) return 'শ্রেণি নির্বাচন করুন।';
  if (Number(v.class_level) >= 9 && !v.group_name) return 'নবম–দশম শ্রেণির জন্য বিভাগ নির্বাচন করুন।';
  return null;
}
const wireUsername = (root) => {
  const u = $('#username', root), hint = $('#u-hint', root);
  u.addEventListener('input', () => { u.value = enDigits(u.value).toLowerCase().replace(/[^a-z0-9_]/g, ''); });
  u.addEventListener('blur', debounce(async () => {
    if (!/^[a-z0-9_]{3,30}$/.test(u.value)) { hint.textContent = ''; return; }
    const { data } = await sb.rpc('username_available', { p_username: u.value });
    hint.textContent = data === false ? 'এই ইউজারনেম নেওয়া হয়ে গেছে।' : '✓ ইউজারনেম পাওয়া যাবে।';
    hint.style.color = data === false ? 'var(--err)' : 'var(--ok)';
  }, 100));
};

export function register({ root }) {
  put(root, authShell('রেজিস্ট্রেশন', 'নতুন অ্যাকাউন্ট খুলুন', html`
    <form id="f" novalidate>
      <div class="field"><label for="full_name">পূর্ণ নাম</label><input id="full_name" name="full_name" autocomplete="name" required maxlength="80"></div>
      <div class="field"><label for="username">ইউজারনেম</label><input id="username" name="username" autocomplete="username" required maxlength="30" placeholder="যেমন: rahim_10">
        <div class="hint" id="u-hint">ছোট হাতের ইংরেজি অক্ষর, সংখ্যা ও _ ব্যবহার করুন।</div></div>
      <div class="field"><label for="email">ইমেইল</label><input id="email" name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="mobile">মোবাইল নম্বর</label><input id="mobile" name="mobile" type="tel" inputmode="numeric" autocomplete="tel" placeholder="01XXXXXXXXX" required></div>
      ${classGroupFields()}
      ${pwField('password', 'পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)', 'new-password')}
      ${pwField('confirm', 'পাসওয়ার্ড নিশ্চিত করুন', 'new-password')}
      <button class="btn primary block" type="submit">অ্যাকাউন্ট খুলুন</button>
    </form>${googleBtn()}
    <p class="center mt muted">আগে থেকেই অ্যাকাউন্ট আছে? <a href="#/login"><b>লগইন করুন</b></a></p>`));
  wireEyes(root); wireGoogle(root); wireClassGroup(root); wireUsername(root);
  const f = $('#f', root);
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('button[type=submit]', f); const v = formObj(f);
    v.mobile = enDigits(v.mobile).replace(/\s|-/g, ''); v.email = v.email.trim();
    const bad = validateProfileFields(v);
    if (bad) return showErr(f, bad);
    if (!/^\S+@\S+\.\S+$/.test(v.email)) return showErr(f, 'সঠিক ইমেইল ঠিকানা দিন।');
    if (v.password.length < 8) return showErr(f, 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
    if (v.password !== v.confirm) return showErr(f, 'পাসওয়ার্ড দুটি মিলছে না।');
    btnBusy(btn, true, ' অপেক্ষা করুন…');
    const { data: ok } = await sb.rpc('username_available', { p_username: v.username });
    if (ok === false) { btnBusy(btn, false); return showErr(f, 'এই ইউজারনেম নেওয়া হয়ে গেছে, অন্যটি বেছে নিন।'); }
    const { data, error } = await sb.auth.signUp({
      email: v.email, password: v.password,
      options: { emailRedirectTo: location.origin + location.pathname,
        data: { full_name: v.full_name.trim(), username: v.username, mobile: v.mobile, class_level: Number(v.class_level), group_name: v.group_name || null } },
    });
    btnBusy(btn, false);
    if (error) return showErr(f, errMsg(error));
    if (data.user && data.user.identities?.length === 0) return showErr(f, errMsg('User already registered'));
    if (data.session) { await loadProfile(); return navigate('/home'); }   // only if "Confirm email" is off in Supabase
    verifyScreen(root, v.email);
  });
}

function verifyScreen(root, email) {
  put(root, authShell('ইমেইল যাচাই করুন', '', html`
    <div class="alert ok">আমরা <b>${email}</b> ঠিকানায় একটি যাচাই লিঙ্ক পাঠিয়েছি। ইনবক্স (বা স্প্যাম ফোল্ডার) দেখে লিঙ্কে ক্লিক করুন, তারপর লগইন করুন।</div>
    <button class="btn soft block" id="resend">আবার পাঠান</button>
    <a class="btn primary block mt" href="#/login">লগইন পেজে যান</a>`));
  $('#resend', root).addEventListener('click', async (e) => {
    e.target.disabled = true;
    const { error } = await sb.auth.resend({ type: 'signup', email });
    toast(error ? errMsg(error) : 'ইমেইল আবার পাঠানো হয়েছে।', error ? 'err' : 'ok');
    setTimeout(() => { e.target.disabled = false; }, 30000);
  });
}

// ------------------------------------------------------------------ forgot / reset
export function forgot({ root }) {
  put(root, authShell('পাসওয়ার্ড রিসেট', 'ইমেইলে রিসেট লিঙ্ক পাঠানো হবে', html`
    <form id="f" novalidate><div class="field"><label for="email">ইমেইল</label><input id="email" name="email" type="email" required autocomplete="email"></div>
    <button class="btn primary block" type="submit">রিসেট লিঙ্ক পাঠান</button></form>
    <p class="center mt"><a href="#/login">← লগইনে ফিরে যান</a></p>`));
  const f = $('#f', root);
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('button', f); const email = f.email.value.trim();
    if (!email) return showErr(f, 'ইমেইল দিন।');
    btnBusy(btn, true, ' পাঠানো হচ্ছে…');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    btnBusy(btn, false);
    if (error) return showErr(f, errMsg(error));
    put(f, html`<div class="alert ok">যদি এই ইমেইলে অ্যাকাউন্ট থাকে, রিসেট লিঙ্ক পাঠানো হয়েছে। ইনবক্স দেখুন।</div>`);
  });
}

export function resetPassword({ root }) {
  if (!state.session) {
    return put(root, authShell('লিঙ্কটি কাজ করছে না', '', html`<div class="alert err">রিসেট লিঙ্কের মেয়াদ শেষ হয়েছে বা এটি আগেই ব্যবহার করা হয়েছে।</div>
      <a class="btn primary block" href="#/forgot">নতুন লিঙ্ক নিন</a>`));
  }
  put(root, authShell('নতুন পাসওয়ার্ড', '', html`<form id="f" novalidate>${pwField('password', 'নতুন পাসওয়ার্ড', 'new-password')}${pwField('confirm', 'নিশ্চিত করুন', 'new-password')}
    <button class="btn primary block" type="submit">পাসওয়ার্ড পরিবর্তন করুন</button></form>`));
  wireEyes(root);
  const f = $('#f', root);
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const v = formObj(f); const btn = $('button[type=submit]', f);
    if (v.password.length < 8) return showErr(f, 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
    if (v.password !== v.confirm) return showErr(f, 'পাসওয়ার্ড দুটি মিলছে না।');
    btnBusy(btn, true, ' অপেক্ষা করুন…');
    const { error } = await sb.auth.updateUser({ password: v.password });
    btnBusy(btn, false);
    if (error) return showErr(f, errMsg(error));
    toast('পাসওয়ার্ড পরিবর্তন হয়েছে।'); logActivity('password_reset');
    await loadProfile(); navigate(isStaff() ? '/admin' : '/home');
  });
}

// ------------------------------------------------------------------ complete profile (Google sign-ups)
export function completeProfile({ root }) {
  const p = state.profile;
  put(root, authShell('প্রোফাইল সম্পূর্ণ করুন', 'শুরু করার আগে আপনার তথ্য দিন', html`
    <form id="f" novalidate>
      <div class="field"><label for="full_name">পূর্ণ নাম</label><input id="full_name" name="full_name" required value="${p.full_name}"></div>
      <div class="field"><label for="username">ইউজারনেম</label><input id="username" name="username" required value="${p.username || ''}"><div class="hint" id="u-hint"></div></div>
      <div class="field"><label for="mobile">মোবাইল নম্বর</label><input id="mobile" name="mobile" type="tel" required value="${p.mobile || ''}" placeholder="01XXXXXXXXX"></div>
      ${classGroupFields(p)}
      <button class="btn primary block" type="submit">সংরক্ষণ করুন</button>
    </form>`));
  wireClassGroup(root); wireUsername(root);
  const f = $('#f', root);
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const v = formObj(f); const btn = $('button[type=submit]', f);
    v.mobile = enDigits(v.mobile).replace(/\s|-/g, '');
    const bad = validateProfileFields(v); if (bad) return showErr(f, bad);
    btnBusy(btn, true, ' সংরক্ষণ হচ্ছে…');
    const { error } = await sb.from('profiles').update({ full_name: v.full_name.trim(), username: v.username, mobile: v.mobile,
      class_level: Number(v.class_level), group_name: Number(v.class_level) >= 9 ? v.group_name : null }).eq('id', state.profile.id);
    btnBusy(btn, false);
    if (error) return showErr(f, errMsg(error));
    await loadProfile(); toast('প্রোফাইল সংরক্ষিত হয়েছে।'); navigate('/home');
  });
}
export { classGroupFields, wireClassGroup, validateProfileFields, enDigits };
