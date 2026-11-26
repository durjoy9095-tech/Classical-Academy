// Student profile area: profile, edit, security, bookmarks, devices, activity, orders, support, doubts, offline, biometric, AI tutor.
import { html, put, icon, $, $$, errMsg, toast, must, money, bn, num, fmtDT, fmtDate, classLabel, groupLabel, ORDER_STATUS, PRODUCT_KINDS, empty, formObj, btnBusy, confirmBox, debounce } from '../lib.js';
import { sb, state, uid, role, isStaff, loadProfile, signOut, deviceId, logActivity, uploadFile, toggleBookmark } from '../db.js';
import { navigate } from '../router.js';
import { avatar, backLink, statusBadge } from '../components.js';
import { classGroupFields, wireClassGroup, validateProfileFields, enDigits } from './public.js';
import { listOffline, removeOffline, openOffline, offlineSupported } from '../offline.js';
import { bioSupported, bioEnabled, bioEnable, bioDisable } from '../biometric.js';

const sub = (title, back = '/profile') => html`${backLink(back)}<h2 class="mb">${title}</h2>`;

// ------------------------------------------------------------------ main profile page
export async function profile({ root }) {
  const p = state.profile;
  const items = [
    ['/profile/edit', 'edit', 'প্রোফাইল সম্পাদনা'], ['/profile/security', 'lock', 'পাসওয়ার্ড ও নিরাপত্তা'], ['/profile/bookmarks', 'bookmark', 'আমার বুকমার্ক'],
    ['/profile/devices', 'device', 'আমার ডিভাইস'], ['/profile/activity', 'activity', 'আমার কার্যকলাপ'], ['/profile/orders', 'receipt', 'অর্ডার ইতিহাস'],
    ['/profile/support', 'chat', 'সাপোর্ট রিপোর্ট'], ['/profile/offline', 'offline', 'অফলাইন কনটেন্ট'], ['/profile/biometric', 'fingerprint', 'বায়োমেট্রিক লগইন'],
    ['/profile/ai-tutor', 'bot', 'এআই টিউটর'], ['/profile/doubt', 'help', 'ডাউট সলভিং'],
  ];
  put(root, html`
    <div class="card pad center">${avatar(p.avatar_url, p.full_name, 'lg')}<h2 style="margin:0">${p.full_name}</h2>
      <p class="muted">@${p.username || '—'} · <span class="badge">${{ super_admin: 'সুপার অ্যাডমিন', admin: 'অ্যাডমিন', moderator: 'মডারেটর', teacher: 'শিক্ষক', student: 'শিক্ষার্থী' }[p.role]}</span></p>
      <div class="meta" style="justify-content:center">${p.class_level ? html`<span>${classLabel(p.class_level)}</span>` : ''}${p.group_name ? html`<span>· ${groupLabel(p.group_name)}</span>` : ''}</div>
      <div class="meta mt" style="justify-content:center"><span>${icon('mail', 15)} ${p.email || ''}</span>${p.mobile ? html`<span>${icon('phone', 15)} ${bn(p.mobile)}</span>` : ''}</div></div>
    <div class="menu-list section">
      ${isStaff() ? html`<a class="menu-item" href="#/admin">${icon('settings', 22)}<span>অ্যাডমিন / শিক্ষক প্যানেল</span><span class="arrow">${icon('arrow', 18)}</span></a>` : ''}
      ${items.map(([to, ic, t]) => html`<a class="menu-item" href="#${to}">${icon(ic, 22)}<span>${t}</span><span class="arrow">${icon('arrow', 18)}</span></a>`)}
      <button class="menu-item" id="out" style="color:var(--err);cursor:pointer;font:inherit;width:100%;text-align:left">${icon('logout', 22)}<span>লগআউট</span></button>
    </div>`);
  $('#out', root).addEventListener('click', async () => {
    if (!(await confirmBox('আপনি কি লগআউট করতে চান?', { yes: 'লগআউট', danger: false }))) return;
    logActivity('logout'); await signOut(); navigate('/');
  });
}

// ------------------------------------------------------------------ edit
export function editProfile({ root }) {
  const p = state.profile;
  put(root, html`${sub('প্রোফাইল সম্পাদনা')}
    <form id="f" class="card pad" novalidate>
      <div class="center mb"><div id="av">${avatar(p.avatar_url, p.full_name, 'lg')}</div>
        <label class="btn soft sm" style="display:inline-flex;margin-top:.4rem">${icon('plus', 16)} ছবি পরিবর্তন<input id="file" type="file" accept="image/png,image/jpeg,image/webp" hidden></label></div>
      <div class="form-grid">
        <div class="field"><label for="full_name">পূর্ণ নাম</label><input id="full_name" name="full_name" value="${p.full_name}" required maxlength="80"></div>
        <div class="field"><label for="username">ইউজারনেম</label><input id="username" name="username" value="${p.username || ''}" required maxlength="30"><div class="hint" id="u-hint"></div></div>
        <div class="field"><label>ইমেইল</label><input value="${p.email || ''}" disabled><div class="hint">ইমেইল এখানে পরিবর্তন করা যায় না।</div></div>
        <div class="field"><label for="mobile">মোবাইল নম্বর</label><input id="mobile" name="mobile" type="tel" value="${p.mobile || ''}" required></div>
      </div>
      ${p.role === 'student' ? classGroupFields(p) : ''}
      <button class="btn primary block" type="submit">পরিবর্তন সংরক্ষণ করুন</button></form>`);
  if (p.role === 'student') wireClassGroup(root);
  const u = $('#username', root), hint = $('#u-hint', root);
  u.addEventListener('input', () => { u.value = enDigits(u.value).toLowerCase().replace(/[^a-z0-9_]/g, ''); });
  u.addEventListener('blur', debounce(async () => {
    if (u.value === p.username || !/^[a-z0-9_]{3,30}$/.test(u.value)) { hint.textContent = ''; return; }
    const { data } = await sb.rpc('username_available', { p_username: u.value });
    hint.textContent = data === false ? 'এই ইউজারনেম নেওয়া হয়ে গেছে।' : '✓ পাওয়া যাবে।'; hint.style.color = data === false ? 'var(--err)' : 'var(--ok)';
  }, 100));
  let newAvatar = null;
  $('#file', root).addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast('ছবি ২ মেগাবাইটের কম হতে হবে।', 'err'); e.target.value = ''; return; }
    newAvatar = f; const url = URL.createObjectURL(f); put($('#av', root), html`<div class="avatar lg"><img src="${url}" alt=""></div>`);
  });
  const f = $('#f', root);
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const v = formObj(f); v.mobile = enDigits(v.mobile).replace(/\s|-/g, ''); const btn = $('button[type=submit]', f);
    const isStu = p.role === 'student';
    if (isStu) { const bad = validateProfileFields(v); if (bad) return toast(bad, 'err'); }
    else if (!/^[a-z0-9_]{3,30}$/.test(v.username) || v.full_name.trim().length < 2) return toast('নাম ও ইউজারনেম সঠিকভাবে দিন।', 'err');
    btnBusy(btn, true, ' সংরক্ষণ হচ্ছে…');
    try {
      const patch = { full_name: v.full_name.trim(), username: v.username, mobile: v.mobile || null };
      if (isStu) { patch.class_level = Number(v.class_level); patch.group_name = Number(v.class_level) >= 9 ? v.group_name : null; }
      if (newAvatar) patch.avatar_url = await uploadFile('avatars', newAvatar, uid());
      must(await sb.from('profiles').update(patch).eq('id', uid()));
      await loadProfile(); logActivity('profile_update'); toast('প্রোফাইল সংরক্ষিত হয়েছে।'); navigate('/profile');
    } catch (err) { btnBusy(btn, false); toast(errMsg(err), 'err'); }
  });
}

// ------------------------------------------------------------------ security
export function security({ root }) {
  const p = state.profile;
  put(root, html`${sub('পাসওয়ার্ড ও নিরাপত্তা')}
    <form id="f" class="card pad" novalidate><h3>পাসওয়ার্ড পরিবর্তন</h3>
      <div class="field"><label>বর্তমান পাসওয়ার্ড</label><input type="password" name="old" autocomplete="current-password" required></div>
      <div class="field"><label>নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)</label><input type="password" name="pw" autocomplete="new-password" minlength="8" required></div>
      <div class="field"><label>নতুন পাসওয়ার্ড নিশ্চিত করুন</label><input type="password" name="pw2" autocomplete="new-password" required></div>
      <button class="btn primary" type="submit">পাসওয়ার্ড বদলান</button></form>
    <div class="card pad mt"><h3>অ্যাকাউন্ট তথ্য</h3><p class="muted">ইমেইল: ${p.email}</p>
      <p class="muted">সর্বশেষ লগইন: ${fmtDT(state.session?.user?.last_sign_in_at)}</p>
      <button class="btn ghost" id="others">অন্য সব ডিভাইস থেকে লগআউট করুন</button></div>`);
  $('#f', root).addEventListener('submit', async (e) => {
    e.preventDefault(); const v = formObj(e.target); const btn = $('button', e.target);
    if (v.pw.length < 8) return toast('নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।', 'err');
    if (v.pw !== v.pw2) return toast('নতুন পাসওয়ার্ড দুটি মিলছে না।', 'err');
    btnBusy(btn, true, ' অপেক্ষা করুন…');
    const chk = await sb.auth.signInWithPassword({ email: p.email, password: v.old });
    if (chk.error) { btnBusy(btn, false); return toast('বর্তমান পাসওয়ার্ড সঠিক নয়।', 'err'); }
    const { error } = await sb.auth.updateUser({ password: v.pw });
    btnBusy(btn, false);
    if (error) return toast(errMsg(error), 'err');
    logActivity('password_change'); toast('পাসওয়ার্ড পরিবর্তন হয়েছে।'); e.target.reset();
  });
  $('#others', root).addEventListener('click', async () => {
    const { error } = await sb.auth.signOut({ scope: 'others' });
    if (error) return toast(errMsg(error), 'err');
    await sb.from('devices').delete().eq('user_id', uid()).neq('device_id', deviceId());
    toast('অন্য সব ডিভাইস থেকে লগআউট হয়েছে।');
  });
}

// ------------------------------------------------------------------ bookmarks
export async function bookmarks({ root }) {
  const rows = must(await sb.from('bookmarks').select('*').eq('user_id', uid()).order('created_at', { ascending: false }));
  const ids = (t) => rows.filter((r) => r.item_type === t).map((r) => r.item_id);
  const get = async (table, t, cols) => ids(t).length ? must(await sb.from(table).select(cols).in('id', ids(t))) : [];
  const [cs, bs, ps] = await Promise.all([get('courses', 'course', 'id,title'), get('books', 'book', 'id,title,author'), get('products', 'product', 'id,title,kind')]);
  const items = [...cs.map((x) => ({ t: 'course', ic: 'courses', id: x.id, title: x.title, sub: 'কোর্স', to: `/course/${x.id}` })),
    ...bs.map((x) => ({ t: 'book', ic: 'library', id: x.id, title: x.title, sub: x.author || 'বই', to: '/library?tab=marks' })),
    ...ps.map((x) => ({ t: 'product', ic: 'store', id: x.id, title: x.title, sub: PRODUCT_KINDS[x.kind], to: `/store/${x.id}` }))];
  put(root, html`${sub('আমার বুকমার্ক')}${items.length ? html`<div class="list">${items.map((i) => html`<div class="li"><div class="ico-box">${icon(i.ic, 20)}</div>
    <a class="grow" href="#${i.to}"><h4>${i.title}</h4><p class="muted small">${i.sub}</p></a><button class="icon-btn" data-rm="${i.t}:${i.id}" aria-label="সরান">${icon('x', 18)}</button></div>`)}</div>` : html`<div class="card">${empty('কোনো বুকমার্ক নেই।', 'bookmark')}</div>`}`);
  $$('[data-rm]', root).forEach((b) => b.addEventListener('click', async () => {
    const [t, id] = b.dataset.rm.split(':'); try { await toggleBookmark(t, id, false); navigate('/profile/bookmarks?keep=1'); } catch (e) { toast(errMsg(e), 'err'); }
  }));
}

// ------------------------------------------------------------------ devices
export async function devices({ root }) {
  const rows = must(await sb.from('devices').select('*').eq('user_id', uid()).order('last_seen', { ascending: false }));
  put(root, html`${sub('আমার ডিভাইস')}${rows.length ? html`<div class="list">${rows.map((d) => html`<div class="li"><div class="ico-box">${icon('device', 20)}</div>
    <div class="grow"><h4>${d.label || 'অজানা ডিভাইস'} ${d.device_id === deviceId() ? html`<span class="badge ok">এই ডিভাইস</span>` : ''}</h4><p class="muted small">সর্বশেষ ব্যবহার: ${fmtDT(d.last_seen)}</p></div>
    ${d.device_id === deviceId() ? '' : html`<button class="btn ghost sm" data-rm="${d.id}">সরান</button>`}</div>`)}</div>` : html`<div class="card">${empty('কোনো ডিভাইস পাওয়া যায়নি।', 'device')}</div>`}
    <p class="muted small mt">কোনো ডিভাইস সন্দেহজনক মনে হলে "পাসওয়ার্ড ও নিরাপত্তা" থেকে অন্য সব ডিভাইস থেকে লগআউট করুন।</p>`);
  $$('[data-rm]', root).forEach((b) => b.addEventListener('click', async () => {
    const { error } = await sb.from('devices').delete().eq('id', b.dataset.rm); if (error) return toast(errMsg(error), 'err'); navigate('/profile/devices?keep=1');
  }));
}

// ------------------------------------------------------------------ activity
const ACT = { login: 'লগইন করেছেন', logout: 'লগআউট করেছেন', enroll: 'কোর্সে ভর্তি হয়েছেন', lesson_done: 'পাঠ সম্পন্ন করেছেন', order: 'অর্ডার করেছেন', exam_start: 'পরীক্ষা শুরু করেছেন',
  exam_submit: 'পরীক্ষা জমা দিয়েছেন', profile_update: 'প্রোফাইল হালনাগাদ করেছেন', password_change: 'পাসওয়ার্ড পরিবর্তন করেছেন', password_reset: 'পাসওয়ার্ড রিসেট করেছেন', open_file: 'ফাইল খুলেছেন', ask_support: 'সাপোর্ট রিপোর্ট পাঠিয়েছেন', ask_doubt: 'ডাউট জমা দিয়েছেন' };
export async function activity({ root }) {
  const rows = must(await sb.from('activity_log').select('*').eq('user_id', uid()).order('created_at', { ascending: false }).limit(60));
  put(root, html`${sub('আমার কার্যকলাপ')}${rows.length ? html`<div class="list">${rows.map((a) => html`<div class="li"><div class="ico-box">${icon('activity', 20)}</div><div class="grow"><h4>${ACT[a.action] || a.action}</h4>
    <p class="muted small">${a.meta?.course || a.meta?.exam || a.meta?.lesson || a.meta?.title || ''}</p></div><span class="small muted">${fmtDT(a.created_at)}</span></div>`)}</div>` : html`<div class="card">${empty('এখনো কোনো কার্যকলাপ নেই।', 'activity')}</div>`}`);
}

// ------------------------------------------------------------------ orders
export async function orders({ root }) {
  const rows = must(await sb.from('orders').select('*, order_items(qty, product:products(title))').eq('user_id', uid()).order('created_at', { ascending: false }));
  put(root, html`${sub('অর্ডার ইতিহাস')}${rows.length ? html`<div class="list">${rows.map((o) => html`<a class="li" href="#/order/${o.id}"><div class="ico-box">${icon('receipt', 20)}</div>
    <div class="grow"><h4>${o.order_items.map((i) => i.product?.title).filter(Boolean).join(', ') || 'অর্ডার'}</h4><p class="muted small">${fmtDT(o.created_at)} · ${money(o.total)}</p></div>${statusBadge(o.status, ORDER_STATUS)}</a>`)}</div>`
    : html`<div class="card">${empty('আপনি এখনো কোনো অর্ডার করেননি।', 'receipt')}<p class="center"><a class="btn primary" href="#/store">স্টোরে যান</a></p><br></div>`}`);
}

// ------------------------------------------------------------------ support + doubts
const STAT = { open: 'অপেক্ষমাণ', answered: 'উত্তর দেওয়া হয়েছে', closed: 'বন্ধ' };
async function ticketPage(root, kind) {
  const isDoubt = kind === 'doubt';
  const rows = must(await sb.from('support_requests').select('*').eq('user_id', uid()).eq('kind', kind).order('created_at', { ascending: false }));
  put(root, html`${sub(isDoubt ? 'ডাউট সলভিং' : 'সাপোর্ট রিপোর্ট')}
    <form id="f" class="card pad" novalidate><h3>${isDoubt ? 'নতুন প্রশ্ন করুন' : 'নতুন রিপোর্ট পাঠান'}</h3>
      ${isDoubt ? html`<p class="muted small">আপনার পড়ার কোনো বিষয়ে আটকে গেলে এখানে লিখুন। শিক্ষক বা মডারেটর উত্তর দেবেন।</p>` : ''}
      <div class="field"><label>${isDoubt ? 'বিষয় / অধ্যায়' : 'বিষয়'}</label><input name="subject" required maxlength="120"></div>
      <div class="field"><label>${isDoubt ? 'আপনার প্রশ্ন' : 'বিস্তারিত'}</label><textarea name="message" required maxlength="3000"></textarea></div>
      <button class="btn primary" type="submit">পাঠান</button></form>
    <div class="section"><h3>আগের ${isDoubt ? 'প্রশ্নসমূহ' : 'রিপোর্টসমূহ'}</h3>${rows.length ? html`<div class="list">${rows.map((r) => html`<div class="card pad">
      <div class="row between"><b>${r.subject}</b>${statusBadge(r.status, STAT)}</div><p class="muted small">${fmtDT(r.created_at)}</p>
      <p style="white-space:pre-line">${r.message}</p>${r.reply ? html`<div class="alert ok" style="white-space:pre-line"><b>উত্তর:</b> ${r.reply}</div>` : ''}</div>`)}</div>` : html`<div class="card">${empty('এখনো কিছু পাঠাননি।', 'chat')}</div>`}</div>`);
  $('#f', root).addEventListener('submit', async (e) => {
    e.preventDefault(); const v = formObj(e.target); const btn = $('button', e.target);
    if (!v.subject.trim() || !v.message.trim()) return toast('সব ঘর পূরণ করুন।', 'err');
    btnBusy(btn, true, ' পাঠানো হচ্ছে…');
    const { error } = await sb.from('support_requests').insert({ user_id: uid(), kind, subject: v.subject.trim(), message: v.message.trim() });
    if (error) { btnBusy(btn, false); return toast(errMsg(error), 'err'); }
    logActivity(isDoubt ? 'ask_doubt' : 'ask_support'); toast('আপনার বার্তা পাঠানো হয়েছে।'); navigate(`/profile/${isDoubt ? 'doubt' : 'support'}?keep=1`);
  });
}
export const support = ({ root }) => ticketPage(root, 'support');
export const doubt = ({ root }) => ticketPage(root, 'doubt');

// ------------------------------------------------------------------ offline
export function offline({ root }) {
  const items = listOffline();
  put(root, html`${sub('অফলাইন কনটেন্ট')}
    <p class="muted">লাইব্রেরি থেকে "অফলাইনে সংরক্ষণ" চাপলে ফাইলটি এই ডিভাইসে জমা থাকে, ইন্টারনেট ছাড়াই পড়া যায়।</p>
    ${!offlineSupported() ? html`<div class="alert err">এই ব্রাউজারে অফলাইন সংরক্ষণ সমর্থিত নয়।</div>` : ''}
    ${items.length ? html`<div class="list">${items.map((i) => html`<div class="li"><div class="ico-box">${icon('file', 20)}</div><div class="grow"><h4>${i.title}</h4><p class="muted small">সংরক্ষিত: ${fmtDate(i.saved_at)}</p></div>
      <button class="btn primary sm" data-open="${i.id}">খুলুন</button><button class="icon-btn" data-rm="${i.id}" aria-label="মুছুন">${icon('trash', 18)}</button></div>`)}</div>`
      : html`<div class="card">${empty('কোনো অফলাইন ফাইল সংরক্ষিত নেই।', 'offline')}<p class="center"><a class="btn primary" href="#/library">লাইব্রেরিতে যান</a></p><br></div>`}`);
  $$('[data-open]', root).forEach((b) => b.addEventListener('click', () => openOffline(b.dataset.open).catch((e) => toast(errMsg(e), 'err'))));
  $$('[data-rm]', root).forEach((b) => b.addEventListener('click', async () => { await removeOffline(b.dataset.rm); navigate('/profile/offline?keep=1'); }));
}

// ------------------------------------------------------------------ biometric
export async function biometric({ root }) {
  const ok = await bioSupported(); const on = bioEnabled();
  put(root, html`${sub('বায়োমেট্রিক লগইন')}<div class="card pad center">
    <div class="ico-box" style="margin:0 auto .6rem;width:64px;height:64px;border-radius:20px">${icon('fingerprint', 34)}</div>
    <h3>ফিঙ্গারপ্রিন্ট / ফেস / স্ক্রিন লক দিয়ে অ্যাপ আনলক</h3>
    <p class="muted">চালু করলে এই ডিভাইসে অ্যাপ খোলার সময় আপনার ডিভাইসের বায়োমেট্রিক যাচাই চাওয়া হবে। আপনার আঙুলের ছাপ বা মুখের তথ্য আমাদের কাছে যায় না।</p>
    ${!ok ? html`<div class="alert err">এই ডিভাইস বা ব্রাউজারে বায়োমেট্রিক সমর্থিত নয় (HTTPS প্রয়োজন)।</div>`
      : on ? html`<span class="badge ok">চালু আছে</span><br><br><button class="btn ghost" id="off">বন্ধ করুন</button>`
      : html`<button class="btn primary" id="on">চালু করুন</button>`}</div>`);
  $('#on', root)?.addEventListener('click', async () => {
    try { await bioEnable(); toast('বায়োমেট্রিক লগইন চালু হয়েছে।'); navigate('/profile/biometric?keep=1'); } catch (e) { toast('চালু করা যায়নি: ' + (e.name === 'NotAllowedError' ? 'অনুমতি দেওয়া হয়নি।' : errMsg(e)), 'err'); }
  });
  $('#off', root)?.addEventListener('click', () => { bioDisable(); toast('বায়োমেট্রিক লগইন বন্ধ হয়েছে।'); navigate('/profile/biometric?keep=1'); });
}

// ------------------------------------------------------------------ AI tutor
export function aiTutor({ root }) {
  put(root, html`${sub('এআই টিউটর')}<div class="card pad center">
    <div class="ico-box" style="margin:0 auto .6rem;width:64px;height:64px;border-radius:20px">${icon('bot', 34)}</div>
    <h3>শীঘ্রই আসছে</h3><p class="muted">এআই টিউটর আপনার প্রশ্নের উত্তর দেবে, কঠিন বিষয় সহজে বুঝিয়ে দেবে এবং অনুশীলন করাবে। ফিচারটি তৈরির কাজ চলছে।</p>
    <p>এর মধ্যে আপনার প্রশ্ন শিক্ষকদের কাছে পাঠাতে পারেন:</p><a class="btn primary" href="#/profile/doubt">${icon('help', 18)} ডাউট সলভিং</a></div>`);
}
