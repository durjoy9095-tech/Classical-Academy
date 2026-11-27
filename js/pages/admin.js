// Admin / teacher / moderator panel sections.
import { html, put, icon, $, $$, errMsg, toast, must, money, bn, num, fmtDT, fmtDate, classLabel, groupLabel, ROLES, PRODUCT_KINDS, EXAM_KINDS, ORDER_STATUS, PAY_METHODS, CLASS_LABELS, GROUPS,
  empty, openModal, confirmBox, debounce, btnBusy, formObj, gradeOf, safeUrl } from '../lib.js';
import { sb, state, uid, role, isAdminUp, getSetting, logActivity } from '../db.js';
import { navigate, ADMIN_NAV, canAdmin } from '../router.js';
import { avatar, statusBadge } from '../components.js';
import { crudPage, openForm, yesNo, pub, imgCell } from './admin-core.js';

const isSuper = () => role() === 'super_admin';
const opt = (map) => Object.entries(map).map(([v, l]) => ({ v, l }));
const classOpts = Object.entries(CLASS_LABELS).map(([v, l]) => ({ v, l }));
const groupOpts = opt(GROUPS);
const subjectOpts = async () => must(await sb.from('subjects').select('id,name,class_level').order('class_level').order('name')).map((s) => ({ v: s.id, l: `${s.name}${s.class_level ? ' (' + classLabel(s.class_level) + ')' : ''}` }));
const teacherOpts = async () => must(await sb.from('teachers').select('id,full_name').order('full_name')).map((t) => ({ v: t.id, l: t.full_name }));
let myTeacherCache = null;
async function myTeacher() {
  if (myTeacherCache?.uid !== uid()) myTeacherCache = { uid: uid(), row: (await sb.from('teachers').select('*').eq('profile_id', uid()).maybeSingle()).data };
  return myTeacherCache.row;
}

// ------------------------------------------------------------------ dispatcher
const sections = {};
export async function adminSection({ root, params, query, path, stale }) {
  const p = `/admin/${params.section}`;
  if (!canAdmin(p)) return put(root, html`<div class="card pad center"><h3>অনুমতি নেই</h3><p class="muted">এই অংশে প্রবেশের অনুমতি আপনার নেই।</p><a class="btn primary" href="#/admin">ড্যাশবোর্ডে ফিরুন</a></div>`);
  const fn = sections[params.section];
  if (!fn) return put(root, html`<div class="card pad center">পেজ পাওয়া যায়নি।</div>`);
  return fn({ root, params, query, stale });
}

// ------------------------------------------------------------------ dashboard
export async function adminHome({ root }) {
  const count = async (table, f) => { let q = sb.from(table).select('*', { count: 'exact', head: true }); if (f) q = f(q); const { count: c } = await q; return c ?? 0; };
  const r = role();
  const cards = [];
  if (['super_admin', 'admin'].includes(r)) {
    const [st, te, co, ex, po, su] = await Promise.all([count('profiles', (q) => q.eq('role', 'student')), count('teachers'), count('courses'), count('exams'), count('orders', (q) => q.eq('status', 'pending')), count('support_requests', (q) => q.eq('status', 'open'))]);
    cards.push(['users', 'শিক্ষার্থী', st, '/admin/users'], ['user', 'শিক্ষক', te, '/admin/teachers'], ['courses', 'কোর্স', co, '/admin/courses'], ['exam', 'পরীক্ষা', ex, '/admin/exams'], ['receipt', 'অপেক্ষমাণ অর্ডার', po, '/admin/orders'], ['chat', 'খোলা সাপোর্ট', su, '/admin/support']);
  } else if (r === 'moderator') {
    const [an, su] = await Promise.all([count('announcements'), count('support_requests', (q) => q.eq('status', 'open'))]);
    cards.push(['bell', 'ঘোষণা', an, '/admin/announcements'], ['chat', 'খোলা সাপোর্ট', su, '/admin/support']);
  } else {
    const t = await myTeacher();
    const [co, ex, db] = await Promise.all([t ? count('courses', (q) => q.eq('teacher_id', t.id)) : 0, count('exams', (q) => q.eq('created_by', uid())), count('support_requests', (q) => q.eq('kind', 'doubt').eq('status', 'open'))]);
    cards.push(['courses', 'আমার কোর্স', co, '/admin/courses'], ['exam', 'আমার পরীক্ষা', ex, '/admin/exams'], ['chat', 'অপেক্ষমাণ ডাউট', db, '/admin/support']);
  }
  const links = ADMIN_NAV.filter((n) => n.roles.includes(r) && n.to !== '/admin');
  put(root, html`<h2 class="page-title">স্বাগতম, ${state.profile.full_name} <span class="badge">${ROLES[r]}</span></h2>
    <div class="grid g-stats">${cards.map(([ic, l, n, to]) => html`<a class="card stat hover" href="#${to}" style="color:inherit">${icon(ic, 26)}<b>${num(n)}</b><span>${l}</span></a>`)}</div>
    <div class="section"><h3>দ্রুত অ্যাক্সেস</h3><div class="quick">${links.map((n) => html`<a href="#${n.to}">${icon(n.ic, 24)}<span>${n.label}</span></a>`)}</div></div>`);
}

// ------------------------------------------------------------------ users
sections.users = async ({ root }) => {
  let rows = [], filter = '';
  const load = async () => { rows = must(await sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(500)); };
  await load();
  const canChange = (u) => u.id !== uid() && (isSuper() || (['student', 'teacher', 'moderator'].includes(u.role)));
  const roleOpts = () => (isSuper() ? Object.keys(ROLES) : ['student', 'moderator', 'teacher']);
  put(root, html`<div class="toolbar"><h2>ব্যবহারকারী</h2><div class="search">${icon('search', 18)}<input id="q" placeholder="নাম, ইউজারনেম, ইমেইল, মোবাইল…"></div>
    <select id="rf" style="width:auto"><option value="">সব ভূমিকা</option>${Object.entries(ROLES).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select></div><div id="tbl"></div>`);
  const draw = () => {
    const q = $('#q', root).value.trim().toLowerCase(), rf = $('#rf', root).value;
    const list = rows.filter((u) => (!rf || u.role === rf) && (!q || [u.full_name, u.username, u.email, u.mobile].join(' ').toLowerCase().includes(q)));
    put($('#tbl', root), list.length ? html`<p class="muted small">${bn(list.length)} জন</p><div class="table-wrap"><table><thead><tr><th></th><th>নাম</th><th>ইউজারনেম</th><th>ইমেইল / মোবাইল</th><th>শ্রেণি</th><th>ভূমিকা</th><th>যোগদান</th><th>কাজ</th></tr></thead><tbody>
      ${list.map((u) => html`<tr><td>${avatar(u.avatar_url, u.full_name, 'sm')}</td><td><b>${u.full_name}</b></td><td>@${u.username || ''}</td><td>${u.email}<br><span class="muted small">${u.mobile || ''}</span></td>
        <td>${u.class_level ? classLabel(u.class_level) + (u.group_name ? ' · ' + groupLabel(u.group_name) : '') : '—'}</td>
        <td>${canChange(u) ? html`<select data-role="${u.id}" style="min-width:130px">${roleOpts().map((r) => html`<option value="${r}" ${u.role === r ? 'selected' : ''}>${ROLES[r]}</option>`)}</select>` : html`<span class="badge">${ROLES[u.role]}</span>`}</td>
        <td>${fmtDate(u.created_at)}</td><td><button class="btn soft sm" data-enr="${u.id}">কোর্সে ভর্তি</button></td></tr>`)}</tbody></table></div>` : html`<div class="card">${empty('কোনো ব্যবহারকারী নেই।', 'users')}</div>`);
    $$('[data-role]', root).forEach((s) => s.addEventListener('change', async () => {
      const u = rows.find((x) => x.id === s.dataset.role), nr = s.value;
      if (!(await confirmBox(`${u.full_name}-এর ভূমিকা "${ROLES[nr]}" করতে চান?`, { danger: false, yes: 'পরিবর্তন করুন' }))) { s.value = u.role; return; }
      try {
        must(await sb.from('profiles').update({ role: nr }).eq('id', u.id));
        if (nr === 'teacher') {   // make sure a public teacher profile exists
          const ex = await sb.from('teachers').select('id').eq('profile_id', u.id).maybeSingle();
          if (!ex.data) must(await sb.from('teachers').insert({ profile_id: u.id, full_name: u.full_name, avatar_url: u.avatar_url }));
        }
        u.role = nr; toast('ভূমিকা পরিবর্তিত হয়েছে।'); draw();
      } catch (e) { s.value = u.role; toast(errMsg(e), 'err'); }
    }));
    $$('[data-enr]', root).forEach((b) => b.addEventListener('click', () => enrollModal(rows.find((x) => x.id === b.dataset.enr))));
  };
  $('#q', root).addEventListener('input', debounce(draw, 150)); $('#rf', root).addEventListener('change', draw);
  draw();
};
async function enrollModal(u) {
  const [cs, en] = await Promise.all([sb.from('courses').select('id,title,class_level').order('title'), sb.from('enrollments').select('id,course_id').eq('user_id', u.id)]);
  const mine = new Set((en.data || []).map((e) => e.course_id));
  openModal(html`<h3>${u.full_name} — কোর্সে ভর্তি</h3>
    <div class="field"><label>কোর্স যোগ করুন</label><select id="cs"><option value="">— নির্বাচন করুন —</option>${(cs.data || []).filter((c) => !mine.has(c.id)).map((c) => html`<option value="${c.id}">${c.title} (${classLabel(c.class_level)})</option>`)}</select></div>
    <button class="btn primary sm" id="add">ভর্তি করুন</button>
    <h4 class="mt">বর্তমান কোর্স</h4><div class="list">${(en.data || []).length ? (en.data).map((e) => html`<div class="li"><div class="grow">${(cs.data || []).find((c) => c.id === e.course_id)?.title || 'কোর্স'}</div><button class="btn ghost sm" data-rm="${e.id}">সরান</button></div>`) : html`<p class="muted">কোনো কোর্স নেই।</p>`}</div>
    <div class="row end mt"><button class="btn ghost" data-close>বন্ধ করুন</button></div>`, { onMount: (m, close) => {
    $('#add', m).addEventListener('click', async () => {
      const id = $('#cs', m).value; if (!id) return;
      const { error } = await sb.from('enrollments').insert({ user_id: u.id, course_id: id }); if (error) return toast(errMsg(error), 'err'); toast('ভর্তি করা হয়েছে।'); close();
    });
    $$('[data-rm]', m).forEach((b) => b.addEventListener('click', async () => { const { error } = await sb.from('enrollments').delete().eq('id', b.dataset.rm); if (error) return toast(errMsg(error), 'err'); toast('সরানো হয়েছে।'); close(); }));
  } });
}

// ------------------------------------------------------------------ teachers / subjects
sections.teachers = crudPage({
  title: 'শিক্ষক', table: 'teachers', order: { col: 'sort_order', asc: true }, search: (r) => `${r.full_name} ${r.subject}`,
  select: '*, profile:profiles(email)',
  columns: [{ label: 'ছবি', render: (r) => imgCell(r.avatar_url) }, { label: 'নাম', render: (r) => html`<b>${r.full_name}</b>` }, { label: 'বিষয়', render: (r) => r.subject || '—' },
    { label: 'যোগ্যতা', render: (r) => r.qualification || '—' }, { label: 'লগইন অ্যাকাউন্ট', render: (r) => r.profile?.email || html`<span class="muted">নেই</span>` }, { label: 'ক্রম', render: (r) => bn(r.sort_order) }],
  fields: [{ name: 'full_name', label: 'পূর্ণ নাম', required: true }, { name: 'avatar_url', label: 'প্রোফাইল ছবি', type: 'image', folder: 'teachers' },
    { name: 'subject', label: 'বিষয়' }, { name: 'qualification', label: 'শিক্ষাগত যোগ্যতা' }, { name: 'experience', label: 'অভিজ্ঞতা', hint: 'যেমন: ৫ বছর' },
    { name: 'profile_id', label: 'লগইন অ্যাকাউন্ট (ঐচ্ছিক)', type: 'select', hint: 'শুধু "শিক্ষক" ভূমিকার ব্যবহারকারী দেখাবে',
      load: async () => must(await sb.from('profiles').select('id,full_name,email').eq('role', 'teacher').order('full_name')).map((p) => ({ v: p.id, l: `${p.full_name} (${p.email})` })) },
    { name: 'sort_order', label: 'প্রদর্শন ক্রম', type: 'number', default: 0, step: 1 }, { name: 'bio', label: 'পরিচিতি', type: 'textarea' }],
});
sections.subjects = crudPage({
  title: 'বিষয়', table: 'subjects', order: { col: 'class_level', asc: true }, search: (r) => r.name,
  columns: [{ label: 'বিষয়ের নাম', render: (r) => html`<b>${r.name}</b>` }, { label: 'শ্রেণি', render: (r) => classLabel(r.class_level) }],
  fields: [{ name: 'name', label: 'বিষয়ের নাম', required: true }, { name: 'class_level', label: 'শ্রেণি', type: 'select', options: classOpts, int: true, required: true }],
});

// ------------------------------------------------------------------ courses + lessons
sections.courses = async (ctx) => {
  const admin = isAdminUp(); const mt = admin ? null : await myTeacher();
  if (!admin && !mt) return put(ctx.root, html`<div class="card pad center"><h3>শিক্ষক প্রোফাইল নেই</h3><p class="muted">অ্যাডমিন আপনার শিক্ষক প্রোফাইল তৈরি করলে কোর্স যোগ করতে পারবেন। (অ্যাডমিন প্যানেল → শিক্ষক)</p></div>`);
  return crudPage({
    title: 'কোর্স', table: 'courses', select: '*, teacher:teachers(full_name), subject:subjects(name)', search: (r) => `${r.title} ${r.teacher?.full_name || ''}`,
    modify: (q) => admin ? q : q.eq('teacher_id', mt.id),
    columns: [{ label: 'ছবি', render: (r) => imgCell(r.thumbnail_url) }, { label: 'কোর্স', render: (r) => html`<b>${r.title}</b><br><span class="muted small">${classLabel(r.class_level)}${r.group_name ? ' · ' + groupLabel(r.group_name) : ''}</span>` },
      { label: 'বিষয়', render: (r) => r.subject?.name || '—' }, { label: 'শিক্ষক', render: (r) => r.teacher?.full_name || '—' }, { label: 'মূল্য', render: (r) => money(r.price) }, { label: 'ফিচার্ড', render: (r) => yesNo(r.featured) }, { label: 'অবস্থা', render: (r) => pub(r.is_published) }],
    extra: (r) => html`<a class="btn primary sm" href="#/admin/lessons/${r.id}">পাঠ</a> <a class="btn soft sm" href="#/admin/course-students/${r.id}">শিক্ষার্থী</a> `,
    fields: [{ name: 'title', label: 'কোর্সের নাম', required: true }, { name: 'class_level', label: 'শ্রেণি', type: 'select', options: classOpts, int: true, required: true },
      { name: 'group_name', label: 'বিভাগ (নবম–দশম)', type: 'select', options: groupOpts, hint: 'সব বিভাগের জন্য ফাঁকা রাখুন' },
      { name: 'subject_id', label: 'বিষয়', type: 'select', load: subjectOpts },
      { name: 'teacher_id', label: 'শিক্ষক', type: 'select', load: teacherOpts, hidden: !admin }, { name: 'price', label: 'মূল্য (৳) — ০ হলে ফ্রি', type: 'number', min: 0, default: 0, required: true },
      { name: 'thumbnail_url', label: 'থাম্বনেইল', type: 'image', folder: 'courses' }, { name: 'featured', label: 'ওয়েলকাম পেজে দেখান', type: 'checkbox', hidden: !admin },
      { name: 'is_published', label: 'প্রকাশ করুন', type: 'checkbox' }, { name: 'description', label: 'বিবরণ', type: 'textarea' }],
    defaults: () => (admin ? {} : { teacher_id: mt.id }),
    beforeSave: (p, row) => { if (!admin) { p.teacher_id = mt.id; delete p.featured; } return p; },
  })(ctx);
};

sections.lessonsFor = (courseId) => crudPage({
  title: 'পাঠসমূহ', back: '/admin/courses', table: 'lessons', filter: { course_id: courseId }, order: { col: 'position', asc: true }, search: (r) => r.title,
  columns: [{ label: 'ক্রম', render: (r) => bn(r.position) }, { label: 'শিরোনাম', render: (r) => html`<b>${r.title}</b>` }, { label: 'ধরন', render: (r) => ({ video: 'ভিডিও', live: 'লাইভ', note: 'নোট' })[r.kind] },
    { label: 'সময়', render: (r) => r.live_at ? fmtDT(r.live_at) : '—' }, { label: 'ফ্রি প্রিভিউ', render: (r) => yesNo(r.is_preview) }],
  fields: [{ name: 'title', label: 'পাঠের শিরোনাম', required: true }, { name: 'kind', label: 'ধরন', type: 'select', options: [{ v: 'video', l: 'রেকর্ডেড ভিডিও' }, { v: 'live', l: 'লাইভ ক্লাস' }, { v: 'note', l: 'নোট / লিঙ্ক' }], default: 'video', required: true },
    { name: 'video_url', label: 'ভিডিও / লাইভ / নোটের লিঙ্ক', type: 'url', hint: 'ইউটিউব, জুম, গুগল মিট বা সরাসরি .mp4 লিঙ্ক' },
    { name: 'live_at', label: 'লাইভ ক্লাসের সময়', type: 'datetime' }, { name: 'position', label: 'ক্রম নম্বর', type: 'number', step: 1, default: 1 }, { name: 'is_preview', label: 'ভর্তি না হলেও দেখা যাবে (প্রিভিউ)', type: 'checkbox' }],
  defaults: () => ({ course_id: courseId }),
});
export const lessonsPage = (ctx) => sections.lessonsFor(ctx.params.id)(ctx);

export async function courseStudents({ root, params }) {
  const c = must(await sb.from('courses').select('title').eq('id', params.id).maybeSingle());
  const [en, ls, pr] = await Promise.all([sb.from('enrollments').select('created_at, student:profiles(id,full_name,username,email,class_level)').eq('course_id', params.id),
    sb.from('lessons').select('id').eq('course_id', params.id), sb.from('lesson_progress').select('user_id,lesson_id')]);
  const lessonIds = new Set((ls.data || []).map((l) => l.id)), total = lessonIds.size;
  const done = {}; (pr.data || []).forEach((p) => { if (lessonIds.has(p.lesson_id)) done[p.user_id] = (done[p.user_id] || 0) + 1; });
  put(root, html`<a class="btn ghost sm mb" href="#/admin/courses">${icon('back', 16)} পেছনে</a><h2>${c?.title} — ভর্তিকৃত শিক্ষার্থী</h2>
    ${(en.data || []).length ? html`<div class="table-wrap"><table><thead><tr><th>নাম</th><th>ইউজারনেম</th><th>শ্রেণি</th><th>ভর্তির তারিখ</th><th>অগ্রগতি</th></tr></thead><tbody>
      ${en.data.map((e) => { const d = done[e.student?.id] || 0, pct = total ? Math.round((d / total) * 100) : 0;
        return html`<tr><td><b>${e.student?.full_name || 'শিক্ষার্থী'}</b></td><td>@${e.student?.username || ''}</td><td>${classLabel(e.student?.class_level)}</td><td>${fmtDate(e.created_at)}</td>
        <td style="min-width:140px"><div class="progress"><i style="width:${pct}%"></i></div><span class="small muted">${bn(d)}/${bn(total)} (${bn(pct)}%)</span></td></tr>`; })}</tbody></table></div>`
      : html`<div class="card">${empty('এখনো কেউ ভর্তি হয়নি।', 'users')}</div>`}`);
}

// ------------------------------------------------------------------ exams / questions / results
sections.exams = async (ctx) => {
  const admin = isAdminUp();
  return crudPage({
    title: 'পরীক্ষা', table: 'exams', select: '*, subject:subjects(name)', search: (r) => r.title, modify: (q) => admin ? q : q.eq('created_by', uid()),
    columns: [{ label: 'পরীক্ষা', render: (r) => html`<b>${r.title}</b><br><span class="muted small">${classLabel(r.class_level)}${r.group_name ? ' · ' + groupLabel(r.group_name) : ''} · ${r.subject?.name || ''}</span>` },
      { label: 'ধরন', render: (r) => EXAM_KINDS[r.kind] }, { label: 'সময়সূচি', render: (r) => html`${r.start_at ? fmtDT(r.start_at) : 'যেকোনো সময়'}${r.end_at ? html`<br><span class="muted small">শেষ: ${fmtDT(r.end_at)}</span>` : ''}` },
      { label: 'সময়/মান', render: (r) => html`${bn(r.duration_minutes)} মি. / ${num(r.total_marks)}` }, { label: 'অবস্থা', render: (r) => pub(r.is_published) }],
    extra: (r) => html`<a class="btn primary sm" href="#/admin/questions/${r.id}">প্রশ্ন</a> <a class="btn soft sm" href="#/admin/results?exam=${r.id}">ফলাফল</a> `,
    fields: [{ name: 'title', label: 'পরীক্ষার নাম', required: true }, { name: 'class_level', label: 'শ্রেণি', type: 'select', options: classOpts, int: true, required: true },
      { name: 'group_name', label: 'বিভাগ', type: 'select', options: groupOpts, hint: 'সবার জন্য ফাঁকা রাখুন' }, { name: 'subject_id', label: 'বিষয়', type: 'select', load: subjectOpts },
      { name: 'kind', label: 'ধরন', type: 'select', options: opt(EXAM_KINDS), default: 'mcq', required: true }, { name: 'duration_minutes', label: 'সময় (মিনিট)', type: 'number', min: 1, step: 1, default: 30, required: true },
      { name: 'start_at', label: 'শুরুর সময়', type: 'datetime' }, { name: 'end_at', label: 'শেষ সময় (এর পর শুরু করা যাবে না)', type: 'datetime' },
      { name: 'pass_marks', label: 'পাস নম্বর', type: 'number', min: 0, default: 0 }, { name: 'is_published', label: 'শিক্ষার্থীদের জন্য প্রকাশ করুন', type: 'checkbox' }],
    defaults: () => ({ created_by: uid() }),
    validate: (p) => { if (p.start_at && p.end_at && new Date(p.end_at) <= new Date(p.start_at)) throw new Error('শেষ সময় শুরুর সময়ের পরে হতে হবে।'); },
  })(ctx);
};

export async function questionsPage({ root, params }) {
  const ex = must(await sb.from('exams').select('id,title,kind').eq('id', params.id).maybeSingle());
  if (!ex) return put(root, html`<div class="card">${empty('পরীক্ষা পাওয়া যায়নি।', 'exam')}</div>`);
  return crudPage({
    title: `প্রশ্ন — ${ex.title}`, back: '/admin/exams', table: 'questions', filter: { exam_id: ex.id }, order: { col: 'position', asc: true }, wide: true, search: (r) => r.body,
    columns: [{ label: 'ক্রম', render: (r) => bn(r.position) }, { label: 'ধরন', render: (r) => r.kind === 'mcq' ? 'এমসিকিউ' : 'লিখিত' },
      { label: 'প্রশ্ন', render: (r) => html`${r.body.slice(0, 110)}${r.body.length > 110 ? '…' : ''}${r.kind === 'mcq' ? html`<br><span class="muted small">সঠিক: ${r.options?.[r.correct_index] ?? '—'}</span>` : ''}` }, { label: 'নম্বর', render: (r) => num(r.marks) }],
    fields: [{ name: 'kind', label: 'ধরন', type: 'select', options: [{ v: 'mcq', l: 'এমসিকিউ' }, { v: 'written', l: 'লিখিত' }], default: 'mcq', required: true },
      { name: 'marks', label: 'নম্বর', type: 'number', min: 0, default: 1, required: true }, { name: 'position', label: 'ক্রম', type: 'number', step: 1, default: 1 },
      { name: 'body', label: 'প্রশ্ন', type: 'textarea', required: true },
      { name: 'options', label: 'অপশন (এমসিকিউ) — প্রতি লাইনে একটি', type: 'lines', hint: 'কমপক্ষে ২টি অপশন দিন' },
      { name: 'correct_index', label: 'সঠিক উত্তরের নম্বর (এমসিকিউ)', type: 'number', step: 1, min: 1, hint: 'যেমন: দ্বিতীয় অপশন সঠিক হলে ২ লিখুন', toForm: (v) => v == null ? '' : v + 1, fromForm: (v) => v == null ? null : Number(v) - 1 }],
    defaults: () => ({ exam_id: ex.id }),
    validate: (p) => {
      if (p.kind === 'mcq') {
        if (!p.options || p.options.length < 2) throw new Error('এমসিকিউ-তে কমপক্ষে ২টি অপশন দিন।');
        if (p.correct_index == null || p.correct_index < 0 || p.correct_index >= p.options.length) throw new Error('সঠিক উত্তরের নম্বর অপশনের সংখ্যার মধ্যে হতে হবে।');
      } else { p.options = null; p.correct_index = null; }
    },
  })({ root });
}

export async function resultsPage({ root, query }) {
  const admin = isAdminUp();
  const exams = must(await sb.from('exams').select('id,title').order('created_at', { ascending: false }));
  let exam = query.exam || '';
  const load = async () => {
    let q = sb.from('exam_attempts').select('*, student:profiles(full_name,username,class_level), exam:exams(title,total_marks,pass_marks)').neq('status', 'in_progress').order('submitted_at', { ascending: false }).limit(500);
    if (exam) q = q.eq('exam_id', exam); return must(await q);
  };
  let rows = await load();
  put(root, html`<div class="toolbar"><h2>ফলাফল</h2><select id="ex" style="width:auto;max-width:280px"><option value="">সব পরীক্ষা</option>${exams.map((e) => html`<option value="${e.id}" ${e.id === exam ? 'selected' : ''}>${e.title}</option>`)}</select>
    <button class="btn soft" id="csv">${icon('download', 18)} CSV</button></div><div id="tbl"></div>`);
  const draw = () => {
    put($('#tbl', root), rows.length ? html`<div class="table-wrap"><table><thead><tr><th>শিক্ষার্থী</th><th>পরীক্ষা</th><th>এমসিকিউ</th><th>লিখিত</th><th>মোট</th><th>গ্রেড</th><th>অবস্থা</th><th>জমার সময়</th><th></th></tr></thead><tbody>
      ${rows.map((a) => { const t = a.exam?.total_marks || 0, pct = t ? (a.total_score / t) * 100 : 0;
        return html`<tr><td><b>${a.student?.full_name || 'শিক্ষার্থী'}</b><br><span class="muted small">@${a.student?.username || ''}</span></td><td>${a.exam?.title}</td><td>${a.mcq_score == null ? '—' : num(a.mcq_score)}</td><td>${a.written_score == null ? '—' : num(a.written_score)}</td>
        <td><b>${num(a.total_score)}</b>/${num(t)}</td><td>${a.status === 'graded' ? gradeOf(pct).g : '—'}</td><td>${statusBadge(a.status, { submitted: 'মূল্যায়ন বাকি', graded: 'সম্পন্ন' })}</td><td>${fmtDT(a.submitted_at)}</td>
        <td>${a.status === 'submitted' || a.written_score != null ? html`<button class="btn primary sm" data-grade="${a.id}">${a.status === 'submitted' ? 'মূল্যায়ন' : 'দেখুন'}</button>` : ''}</td></tr>`; })}</tbody></table></div>` : html`<div class="card">${empty('কোনো ফলাফল নেই।', 'chart')}</div>`);
    $$('[data-grade]', root).forEach((b) => b.addEventListener('click', () => gradeModal(rows.find((x) => x.id === b.dataset.grade), async () => { rows = await load(); draw(); })));
  };
  $('#ex', root).addEventListener('change', async (e) => { exam = e.target.value; rows = await load(); draw(); });
  $('#csv', root).addEventListener('click', () => {
    const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = [['শিক্ষার্থী', 'ইউজারনেম', 'পরীক্ষা', 'এমসিকিউ', 'লিখিত', 'মোট', 'পূর্ণমান', 'অবস্থা'].map(esc).join(',')]
      .concat(rows.map((a) => [a.student?.full_name, a.student?.username, a.exam?.title, a.mcq_score, a.written_score, a.total_score, a.exam?.total_marks, a.status].map(esc).join(',')));
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'results.csv'; a.click(); URL.revokeObjectURL(url);
  });
  draw();
}
async function gradeModal(a, done) {
  const qs = must(await sb.from('questions').select('*').eq('exam_id', a.exam_id).order('position'));
  const written = qs.filter((q) => q.kind === 'written'), max = written.reduce((s, q) => s + Number(q.marks), 0);
  openModal(html`<h3>${a.student?.full_name} — ${a.exam?.title}</h3>
    ${qs.map((q, i) => html`<div class="q-edit"><b>${bn(i + 1)}. ${q.body}</b> <span class="badge">${num(q.marks)}</span>
      ${q.kind === 'mcq' ? html`<p class="small ${a.answers?.[q.id] === q.correct_index ? '' : 'muted'}">উত্তর: ${a.answers?.[q.id] != null ? q.options?.[a.answers[q.id]] : '—'} ${a.answers?.[q.id] === q.correct_index ? '✓' : ''}</p>`
        : html`<div class="alert info" style="white-space:pre-line;margin:.5rem 0 0">${a.answers?.[q.id] || 'উত্তর দেয়নি'}</div>`}</div>`)}
    <form id="g"><div class="field"><label>লিখিত অংশের প্রাপ্ত নম্বর (সর্বোচ্চ ${num(max)})</label><input type="number" name="s" min="0" max="${max}" step="any" value="${a.written_score ?? ''}" required></div>
      <div class="row end gap"><button type="button" class="btn ghost" data-close>বন্ধ</button><button class="btn primary" type="submit">নম্বর সংরক্ষণ</button></div></form>`, { wide: true, onMount: (m, close) => {
    $('#g', m).addEventListener('submit', async (e) => {
      e.preventDefault(); const s = Number(e.target.s.value);
      if (!(s >= 0 && s <= max)) return toast(`নম্বর ০ থেকে ${bn(max)} এর মধ্যে হতে হবে।`, 'err');
      const { error } = await sb.from('exam_attempts').update({ written_score: s, status: 'graded' }).eq('id', a.id);
      if (error) return toast(errMsg(error), 'err'); toast('নম্বর সংরক্ষিত হয়েছে।'); close(); done();
    });
  } });
}

// ------------------------------------------------------------------ library books / store products
sections.books = crudPage({
  title: 'লাইব্রেরি বই', table: 'books', select: '*, subject:subjects(name)', search: (r) => `${r.title} ${r.author}`,
  columns: [{ label: 'কভার', render: (r) => imgCell(r.cover_url) }, { label: 'বই', render: (r) => html`<b>${r.title}</b><br><span class="muted small">${r.author || ''}</span>` }, { label: 'শ্রেণি', render: (r) => r.class_level ? classLabel(r.class_level) : 'সব' },
    { label: 'বিষয়', render: (r) => r.subject?.name || '—' }, { label: 'অবস্থা', render: (r) => pub(r.is_published) }],
  fields: [{ name: 'title', label: 'বইয়ের নাম', required: true }, { name: 'author', label: 'লেখক' }, { name: 'class_level', label: 'শ্রেণি', type: 'select', options: classOpts, int: true },
    { name: 'subject_id', label: 'বিষয়', type: 'select', load: subjectOpts }, { name: 'cover_url', label: 'কভার ছবি', type: 'image', folder: 'covers' },
    { name: 'file_path', label: 'বইয়ের ফাইল (পিডিএফ)', type: 'file', required: true, accept: '.pdf,.epub,.doc,.docx,.ppt,.pptx', hint: 'গোপন স্টোরেজে রাখা হবে' },
    { name: 'is_published', label: 'প্রকাশ করুন', type: 'checkbox', default: true }, { name: 'description', label: 'বিবরণ', type: 'textarea' }],
});
sections.products = crudPage({
  title: 'স্টোর পণ্য', table: 'products', modify: (q) => q.neq('kind', 'course'), search: (r) => r.title,
  intro: 'প্রিমিয়াম কোর্স স্বয়ংক্রিয়ভাবে স্টোরে যুক্ত হয় — কোর্স পেজে মূল্য দিন।',
  columns: [{ label: 'ছবি', render: (r) => imgCell(r.image_url) }, { label: 'পণ্য', render: (r) => html`<b>${r.title}</b>` }, { label: 'ধরন', render: (r) => PRODUCT_KINDS[r.kind] }, { label: 'মূল্য', render: (r) => money(r.price) },
    { label: 'ফাইল', render: (r) => yesNo(!!r.file_path) }, { label: 'অবস্থা', render: (r) => pub(r.is_published) }],
  fields: [{ name: 'title', label: 'পণ্যের নাম', required: true }, { name: 'kind', label: 'ধরন', type: 'select', options: opt(Object.fromEntries(Object.entries(PRODUCT_KINDS).filter(([k]) => k !== 'course'))), default: 'book', required: true },
    { name: 'price', label: 'মূল্য (৳)', type: 'number', min: 0, default: 0, required: true }, { name: 'image_url', label: 'পণ্যের ছবি', type: 'image', folder: 'products' },
    { name: 'file_path', label: 'ডিজিটাল ফাইল', type: 'file', hint: 'ক্রয় সম্পন্ন হলে শিক্ষার্থী লাইব্রেরিতে পাবে' }, { name: 'is_published', label: 'প্রকাশ করুন', type: 'checkbox' }, { name: 'description', label: 'বিবরণ', type: 'textarea' }],
});

// ------------------------------------------------------------------ orders / payments
sections.orders = async ({ root }) => {
  let status = 'pending', rows = [];
  const load = async () => { rows = must(await sb.from('orders').select('*, student:profiles(full_name,username,mobile), payments(*), order_items(qty, price, product:products(title))').order('created_at', { ascending: false }).limit(300)); };
  await load();
  put(root, html`<div class="toolbar"><h2>অর্ডার</h2></div><div class="tabs">${[['pending', 'যাচাই বাকি'], ['paid', 'পরিশোধিত'], ['cancelled', 'বাতিল'], ['', 'সব']].map(([k, v]) => html`<button class="tab ${k === status ? 'active' : ''}" data-s="${k}">${v}</button>`)}</div><div id="tbl"></div>`);
  const draw = () => {
    const list = rows.filter((o) => !status || o.status === status);
    put($('#tbl', root), list.length ? html`<div class="table-wrap"><table><thead><tr><th>অর্ডার</th><th>শিক্ষার্থী</th><th>পণ্য</th><th>মোট</th><th>পেমেন্ট</th><th>অবস্থা</th><th>কাজ</th></tr></thead><tbody>
      ${list.map((o) => { const p = o.payments?.[0]; return html`<tr><td><code>${o.id.slice(0, 8).toUpperCase()}</code><br><span class="muted small">${fmtDT(o.created_at)}</span></td>
        <td><b>${o.student?.full_name}</b><br><span class="muted small">${o.student?.mobile || ''}</span></td><td>${o.order_items.map((i) => html`<div>${i.product?.title} × ${bn(i.qty)}</div>`)}</td><td><b>${money(o.total)}</b></td>
        <td>${p && o.total > 0 ? html`${PAY_METHODS[p.method] || p.method}<br><span class="small">TrxID: <b>${p.trx_id}</b></span><br><span class="muted small">${p.sender_number || ''}</span>` : '—'}</td><td>${statusBadge(o.status, ORDER_STATUS)}</td>
        <td>${o.status === 'pending' ? html`<button class="btn primary sm" data-ok="${o.id}">নিশ্চিত</button> <button class="btn danger sm" data-no="${o.id}">বাতিল</button>` : ''}</td></tr>`; })}</tbody></table></div>` : html`<div class="card">${empty('কোনো অর্ডার নেই।', 'receipt')}</div>`);
    $$('[data-ok]', root).forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmBox('পেমেন্ট যাচাই হয়েছে? নিশ্চিত করলে শিক্ষার্থী কোর্স/ফাইল পেয়ে যাবে।', { danger: false, yes: 'নিশ্চিত করুন' }))) return;
      const { error } = await sb.rpc('confirm_order', { p_order: b.dataset.ok }); if (error) return toast(errMsg(error), 'err'); toast('অর্ডার নিশ্চিত হয়েছে।'); await load(); draw();
    }));
    $$('[data-no]', root).forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmBox('এই অর্ডার বাতিল করবেন?'))) return;
      const { error } = await sb.rpc('reject_order', { p_order: b.dataset.no }); if (error) return toast(errMsg(error), 'err'); toast('অর্ডার বাতিল হয়েছে।'); await load(); draw();
    }));
  };
  $$('[data-s]', root).forEach((b) => b.addEventListener('click', () => { status = b.dataset.s; $$('[data-s]', root).forEach((x) => x.classList.toggle('active', x === b)); draw(); }));
  draw();
};
sections.payments = async ({ root }) => {
  const rows = must(await sb.from('payments').select('*, student:profiles(full_name,username), order:orders(id,status)').order('created_at', { ascending: false }).limit(300));
  const verified = rows.filter((r) => r.status === 'verified').reduce((s, r) => s + Number(r.amount), 0);
  put(root, html`<div class="toolbar"><h2>পেমেন্ট রেকর্ড</h2></div><div class="grid g-stats mb"><div class="card stat"><b>${money(verified) === 'বিনামূল্যে' ? '৳০' : money(verified)}</b><span>যাচাইকৃত মোট আয়</span></div>
    <div class="card stat"><b>${num(rows.filter((r) => r.status === 'pending').length)}</b><span>যাচাই বাকি</span></div></div>
    ${rows.length ? html`<div class="table-wrap"><table><thead><tr><th>তারিখ</th><th>শিক্ষার্থী</th><th>পরিমাণ</th><th>মাধ্যম</th><th>TrxID</th><th>প্রেরকের নম্বর</th><th>অবস্থা</th></tr></thead><tbody>
      ${rows.map((p) => html`<tr><td>${fmtDT(p.created_at)}</td><td>${p.student?.full_name}</td><td>${money(p.amount)}</td><td>${PAY_METHODS[p.method] || '—'}</td><td>${p.trx_id || '—'}</td><td>${p.sender_number || '—'}</td>
      <td>${statusBadge(p.status, { pending: 'বাকি', verified: 'যাচাইকৃত', rejected: 'বাতিল' })}</td></tr>`)}</tbody></table></div>` : html`<div class="card">${empty('কোনো পেমেন্ট নেই।', 'receipt')}</div>`}`);
};

// ------------------------------------------------------------------ announcements / support
sections.announcements = crudPage({
  title: 'ঘোষণা', table: 'announcements', search: (r) => r.title,
  columns: [{ label: 'শিরোনাম', render: (r) => html`<b>${r.title}</b><br><span class="muted small">${(r.body || '').slice(0, 90)}</span>` }, { label: 'তারিখ', render: (r) => fmtDate(r.created_at) }, { label: 'অবস্থা', render: (r) => pub(r.is_published) }],
  fields: [{ name: 'title', label: 'শিরোনাম', required: true }, { name: 'body', label: 'বিস্তারিত', type: 'textarea' }, { name: 'is_published', label: 'প্রকাশ করুন', type: 'checkbox', default: true }],
});
sections.support = async ({ root }) => {
  let kind = '', st = 'open', rows = [];
  const load = async () => { rows = must(await sb.from('support_requests').select('*, student:profiles!support_requests_user_id_fkey(full_name,username,class_level)').order('created_at', { ascending: false }).limit(300)); };
  await load();
  put(root, html`<div class="toolbar"><h2>সাপোর্ট ও ডাউট</h2>
    <select id="k" style="width:auto"><option value="">সব ধরন</option><option value="support">সাপোর্ট</option><option value="doubt">ডাউট</option></select>
    <select id="s" style="width:auto"><option value="open">অপেক্ষমাণ</option><option value="answered">উত্তর দেওয়া</option><option value="closed">বন্ধ</option><option value="">সব</option></select></div><div id="tbl"></div>`);
  const draw = () => {
    const list = rows.filter((r) => (!kind || r.kind === kind) && (!st || r.status === st));
    put($('#tbl', root), list.length ? html`<div class="list">${list.map((r) => html`<div class="card pad"><div class="row between wrap"><div><b>${r.subject}</b> <span class="badge">${r.kind === 'doubt' ? 'ডাউট' : 'সাপোর্ট'}</span></div>${statusBadge(r.status, { open: 'অপেক্ষমাণ', answered: 'উত্তর দেওয়া', closed: 'বন্ধ' })}</div>
      <p class="muted small">${r.student?.full_name} (@${r.student?.username}) · ${r.student?.class_level ? classLabel(r.student.class_level) : ''} · ${fmtDT(r.created_at)}</p><p style="white-space:pre-line">${r.message}</p>
      ${r.reply ? html`<div class="alert ok" style="white-space:pre-line"><b>উত্তর:</b> ${r.reply}</div>` : ''}
      <div class="row gap wrap"><button class="btn primary sm" data-reply="${r.id}">${r.reply ? 'উত্তর সম্পাদনা' : 'উত্তর দিন'}</button>${r.status !== 'closed' ? html`<button class="btn ghost sm" data-close-t="${r.id}">বন্ধ করুন</button>` : ''}</div></div>`)}</div>` : html`<div class="card">${empty('কিছু নেই।', 'chat')}</div>`);
    $$('[data-reply]', root).forEach((b) => b.addEventListener('click', () => {
      const r = rows.find((x) => x.id === b.dataset.reply);
      openModal(html`<h3>উত্তর দিন</h3><p class="muted" style="white-space:pre-line">${r.message}</p><form id="rf"><div class="field"><label>আপনার উত্তর</label><textarea name="reply" required maxlength="4000">${r.reply || ''}</textarea></div>
        <div class="row end gap"><button type="button" class="btn ghost" data-close>বাতিল</button><button class="btn primary" type="submit">পাঠান</button></div></form>`, { onMount: (m, close) => {
        $('#rf', m).addEventListener('submit', async (e) => { e.preventDefault(); const reply = e.target.reply.value.trim(); if (!reply) return;
          const { error } = await sb.from('support_requests').update({ reply, status: 'answered', replied_by: uid() }).eq('id', r.id);
          if (error) return toast(errMsg(error), 'err'); toast('উত্তর পাঠানো হয়েছে।'); close(); await load(); draw(); });
      } });
    }));
    $$('[data-close-t]', root).forEach((b) => b.addEventListener('click', async () => { const { error } = await sb.from('support_requests').update({ status: 'closed' }).eq('id', b.dataset.closeT); if (error) return toast(errMsg(error), 'err'); await load(); draw(); }));
  };
  $('#k', root).addEventListener('change', (e) => { kind = e.target.value; draw(); }); $('#s', root).addEventListener('change', (e) => { st = e.target.value; draw(); });
  draw();
};

// ------------------------------------------------------------------ welcome page + settings (Super Admin)
const saveSetting = async (key, value) => must(await sb.from('site_settings').upsert({ key, value, updated_at: new Date().toISOString() }));
sections.welcome = async ({ root }) => {
  const w = await getSetting('welcome');
  put(root, html`<h2 class="page-title">ওয়েলকাম পেজ ম্যানেজ করুন</h2>
    <form id="f" class="card pad"><div class="form-grid">
      <div class="field" style="grid-column:1/-1"><label>প্রধান শিরোনাম</label><input name="hero_title" value="${w.hero_title || ''}" maxlength="120"></div>
      <div class="field" style="grid-column:1/-1"><label>উপশিরোনাম</label><input name="hero_subtitle" value="${w.hero_subtitle || ''}" maxlength="240"></div>
      <div class="field" style="grid-column:1/-1"><label>পরিচিতি</label><textarea name="intro" rows="3">${w.intro || ''}</textarea></div>
      <div class="field"><label>ইউটিউব চ্যানেল লিঙ্ক</label><input name="youtube_channel_url" type="url" value="${w.youtube_channel_url || ''}" placeholder="https://youtube.com/@..."></div>
      <div class="field" style="grid-column:1/-1"><label>ইউটিউব ভিডিও লিঙ্ক (প্রতি লাইনে একটি)</label><textarea name="video_urls" rows="4">${(w.video_urls || []).join('\n')}</textarea></div>
      <div class="field"><label>যোগাযোগের ফোন</label><input name="contact_phone" value="${w.contact_phone || ''}"></div>
      <div class="field"><label>যোগাযোগের ইমেইল</label><input name="contact_email" type="email" value="${w.contact_email || ''}"></div>
      <div class="field"><label>ঠিকানা</label><input name="contact_address" value="${w.contact_address || ''}"></div>
      <div class="field"><label>সাপোর্টের সময়</label><input name="support_hours" value="${w.support_hours || ''}" placeholder="যেমন: প্রতিদিন সকাল ১০টা – রাত ৮টা"></div></div>
      <button class="btn primary" type="submit">সংরক্ষণ করুন</button> <a class="btn ghost" href="#/" target="_blank">পেজ দেখুন</a></form>
    <p class="muted mt">নির্বাচিত কোর্স, শিক্ষক ও ঘোষণা সংশ্লিষ্ট সেকশন থেকে পরিচালিত হয়: <a href="#/admin/courses">কোর্স</a> · <a href="#/admin/teachers">শিক্ষক</a> · <a href="#/admin/announcements">ঘোষণা</a>।</p>`);
  $('#f', root).addEventListener('submit', async (e) => {
    e.preventDefault(); const v = formObj(e.target), btn = $('button[type=submit]', e.target); btnBusy(btn, true, ' সংরক্ষণ হচ্ছে…');
    try {
      const video_urls = v.video_urls.split('\n').map((s) => s.trim()).filter(Boolean);
      await saveSetting('welcome', { ...w, ...v, video_urls }); toast('ওয়েলকাম পেজ হালনাগাদ হয়েছে।');
    } catch (err) { toast(errMsg(err), 'err'); } btnBusy(btn, false);
  });
};
sections.settings = async ({ root }) => {
  const pay = await getSetting('payment');
  put(root, html`<h2 class="page-title">সাইট সেটিংস</h2>
    <form id="f" class="card pad"><h3>পেমেন্ট তথ্য</h3><p class="muted small">শিক্ষার্থীরা চেকআউটের সময় এই নম্বরগুলো দেখে টাকা পাঠাবে। তারপর "অর্ডার" পেজ থেকে আপনি TrxID মিলিয়ে নিশ্চিত করবেন।</p>
      <div class="form-grid"><div class="field"><label>বিকাশ নম্বর</label><input name="bkash" value="${pay.bkash || ''}"></div><div class="field"><label>নগদ নম্বর</label><input name="nagad" value="${pay.nagad || ''}"></div>
        <div class="field"><label>রকেট নম্বর</label><input name="rocket" value="${pay.rocket || ''}"></div></div>
      <div class="field"><label>নির্দেশনা</label><textarea name="note" rows="3">${pay.note || ''}</textarea></div><button class="btn primary" type="submit">সংরক্ষণ করুন</button></form>
    <div class="card pad mt"><h3>ভূমিকা (Role) ব্যবস্থাপনা</h3><p class="muted">ব্যবহারকারীর ভূমিকা বদলাতে <a href="#/admin/users">ব্যবহারকারী</a> পেজে যান। শুধু সুপার অ্যাডমিন অ্যাডমিন/সুপার অ্যাডমিন নিয়োগ দিতে পারেন।</p></div>`);
  $('#f', root).addEventListener('submit', async (e) => {
    e.preventDefault(); const v = formObj(e.target), btn = $('button[type=submit]', e.target); btnBusy(btn, true, ' সংরক্ষণ হচ্ছে…');
    try { await saveSetting('payment', { ...pay, ...v }); toast('সংরক্ষিত হয়েছে।'); } catch (err) { toast(errMsg(err), 'err'); } btnBusy(btn, false);
  });
};

/* =========================================================
   CLASSICAL ACADEMY — MODERATOR FREE TRIAL SUBSCRIPTION
========================================================= */

sections['free-trial'] = async ({ root }) => {
  let student = null;
  let enrollments = [];
  let courses = [];
  let trials = [];

  put(root, html`
    <div class="toolbar">
      <h2>Free Trial Subscription</h2>
    </div>

    <div class="card pad">
      <div class="field">
        <label>শিক্ষার্থীর মোবাইল নম্বর</label>

        <div class="row gap">
          <input
            id="trial-phone"
            type="tel"
            placeholder="মোবাইল নম্বর লিখুন"
          />

          <button class="btn primary" id="trial-search">
            খুঁজুন
          </button>
        </div>
      </div>
    </div>

    <div id="trial-result" class="mt"></div>
  `);

  const searchStudent = async () => {
    const phone = $('#trial-phone', root).value.trim();

    if (!phone) {
      return toast('মোবাইল নম্বর লিখুন।', 'err');
    }

    const btn = $('#trial-search', root);
    btnBusy(btn, true, 'খোঁজা হচ্ছে…');

    try {
      student = null;
      enrollments = [];
      courses = [];
      trials = [];

      const profile = must(
        await sb.from('profiles')
          .select('*')
          .ilike('mobile', `%${phone}%`)
          .eq('role', 'student')
          .limit(1)
      );

      if (!profile.length) {
        put($('#trial-result', root), html`
          <div class="card pad center">
            <h3>শিক্ষার্থী পাওয়া যায়নি</h3>
            <p class="muted">
              মোবাইল নম্বরটি সঠিক কিনা পরীক্ষা করুন।
            </p>
          </div>
        `);
        return;
      }

      student = profile[0];

      enrollments = must(
        await sb.from('enrollments')
          .select('course_id, created_at')
          .eq('user_id', student.id)
      );

      const courseIds = enrollments.map(e => e.course_id);

      if (courseIds.length) {
        courses = must(
          await sb.from('courses')
            .select('id,title,class_level,price')
            .in('id', courseIds)
        );

        trials = must(
          await sb.from('free_trial_subscriptions')
            .select('*')
            .eq('user_id', student.id)
        );
      }

      drawStudent();

    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      btnBusy(btn, false);
    }
  };

  const drawStudent = () => {
    const activeTrial = (courseId) =>
      trials.find(t =>
        t.course_id === courseId &&
        t.status === 'enabled' &&
        new Date(t.end_at) > new Date()
      );

    put($('#trial-result', root), html`
      <div class="card pad">
        <h3>শিক্ষার্থীর তথ্য</h3>

        <div class="grid g-stats">
          <div>
            <span class="muted">নাম</span>
            <b>${student.full_name || '—'}</b>
          </div>

          <div>
            <span class="muted">মোবাইল</span>
            <b>${student.mobile || '—'}</b>
          </div>

          <div>
            <span class="muted">শ্রেণি</span>
            <b>${student.class_level
              ? classLabel(student.class_level)
              : '—'}</b>
          </div>

          <div>
            <span class="muted">বিভাগ</span>
            <b>${student.group_name
              ? groupLabel(student.group_name)
              : '—'}</b>
          </div>
        </div>
      </div>

      <div class="card pad mt">
        <h3>Enrolled Programs</h3>

        ${courses.length
          ? html`
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Program Name</th>
                    <th>Enrollment Type</th>
                    <th>Free Trial</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  ${courses.map(c => {
                    const trial = activeTrial(c.id);

                    return html`
                      <tr>
                        <td>
                          <b>${c.title}</b>
                        </td>

                        <td>
                          ${Number(c.price) > 0
                            ? 'Paid'
                            : 'Free'}
                        </td>

                        <td>
                          ${trial
                            ? 'Enabled'
                            : 'Not Enabled'}
                        </td>

                        <td>
                          ${trial
                            ? html`
                              <span class="badge">
                                Trial Active
                              </span>
                            `
                            : html`
                              <button
                                class="btn primary sm"
                                data-trial="${c.id}"
                              >
                                Enable Trial
                              </button>
                            `}
                        </td>
                      </tr>
                    `;
                  })}
                </tbody>
              </table>
            </div>
          `
          : html`
            <p class="muted">
              এই শিক্ষার্থী এখনো কোনো কোর্সে ভর্তি হয়নি।
            </p>
          `}
      </div>
    `);

    $$('[data-trial]', root).forEach(btn => {
      btn.addEventListener('click', async () => {
        const courseId = btn.dataset.trial;

        if (!(await confirmBox(
          'এই কোর্সের Free Trial ৭ দিনের জন্য চালু করবেন?',
          {
            danger: false,
            yes: 'Trial চালু করুন'
          }
        ))) return;

        try {
          const now = new Date();
          const end = new Date(
            now.getTime() + 7 * 24 * 60 * 60 * 1000
          );

          must(
            await sb.from('free_trial_subscriptions')
              .upsert({
                user_id: student.id,
                course_id: courseId,
                status: 'enabled',
                start_at: now.toISOString(),
                end_at: end.toISOString(),
                granted_by: uid()
              }, {
                onConflict: 'user_id,course_id'
              })
          );

          toast('Free Trial Subscription ENABLED');

          await searchStudent();

        } catch (e) {
          toast(errMsg(e), 'err');
        }
      });
    });
  };

  $('#trial-search', root)
    .addEventListener('click', searchStudent);

  $('#trial-phone', root)
    .addEventListener('keydown', e => {
      if (e.key === 'Enter') searchStudent();
    });
};

sections['enrollment'] = async ({ root }) => {
  let student = null;
  let enrolled = [];
  let allCourses = [];

  put(root, html`
    <div class="toolbar">
      <h2>Student Enrollment</h2>
    </div>

    <div class="card pad">
      <div class="field">
        <label>শিক্ষার্থীর মোবাইল নম্বর</label>
        <div class="row gap">
          <input id="enroll-phone" type="tel"
            placeholder="মোবাইল নম্বর লিখুন"/>
          <button class="btn primary" id="enroll-search">
            খুঁজুন
          </button>
        </div>
      </div>
    </div>

    <div id="enroll-result" class="mt"></div>
  `);

  const searchStudent = async () => {
    const phone = $('#enroll-phone', root).value.trim();

    if (!phone) {
      return toast('মোবাইল নম্বর লিখুন।', 'err');
    }

    const btn = $('#enroll-search', root);
    btnBusy(btn, true, 'খোঁজা হচ্ছে…');

    try {
      student = null;
      enrolled = [];
      allCourses = [];

      const profiles = must(
        await sb.from('profiles')
          .select('id,full_name,mobile,class_level,role')
          .ilike('mobile', `%${phone}%`)
          .eq('role', 'student')
          .limit(1)
      );

      if (!profiles.length) {
        put($('#enroll-result', root), html`
          <div class="card pad center">
            <h3>শিক্ষার্থী পাওয়া যায়নি</h3>
            <p class="muted">
              মোবাইল নম্বরটি পরীক্ষা করুন।
            </p>
          </div>
        `);
        return;
      }

      student = profiles[0];

      enrolled = must(
        await sb.from('enrollments')
          .select('id,user_id,course_id,created_at')
          .eq('user_id', student.id)
      );

      allCourses = must(
        await sb.from('courses')
          .select('id,title,class_level')
      );

      drawEnrollment();

    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      btnBusy(btn, false);
    }
  };

  const drawEnrollment = () => {
    const enrolledIds = enrolled.map(e => e.course_id);

    const availableCourses = allCourses.filter(
      c => !enrolledIds.includes(c.id)
    );

    put($('#enroll-result', root), html`
      <div class="card pad">
        <h3>শিক্ষার্থীর তথ্য</h3>

        <div class="grid g-stats">
          <div>
            <span class="muted">নাম</span>
            <b>${student.full_name || '—'}</b>
          </div>

          <div>
            <span class="muted">মোবাইল</span>
            <b>${student.mobile || '—'}</b>
          </div>

          <div>
            <span class="muted">শ্রেণি</span>
            <b>${student.class_level
              ? classLabel(student.class_level)
              : '—'}</b>
          </div>
        </div>
      </div>

      <div class="card pad mt">
        <h3>কোর্সে ভর্তি করুন</h3>

        ${availableCourses.length
          ? html`
            <div class="field">
              <label>কোর্স নির্বাচন করুন</label>

              <select id="enroll-course">
                <option value="">কোর্স নির্বাচন করুন</option>

                ${availableCourses.map(c => html`
                  <option value="${c.id}">
                    ${c.title}
                  </option>
                `)}
              </select>
            </div>

            <button class="btn primary mt"
              id="enroll-submit">
              ভর্তি করুন
            </button>
          `
          : html`
            <p class="muted">
              সব কোর্সে শিক্ষার্থী ইতিমধ্যে ভর্তি আছে।
            </p>
          `}
      </div>

      <div class="card pad mt">
        <h3>ভর্তিকৃত কোর্স</h3>

        ${enrolled.length
          ? html`
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>কোর্সের নাম</th>
                    <th>ভর্তির তারিখ</th>
                  </tr>
                </thead>

                <tbody>
                  ${enrolled.map(e => {
                    const course = allCourses.find(
                      c => c.id === e.course_id
                    );

                    return html`
                      <tr>
                        <td>${course?.title || 'কোর্স'}</td>
                        <td>
                          ${e.created_at
                            ? fmtDate(e.created_at)
                            : '—'}
                        </td>
                      </tr>
                    `;
                  })}
                </tbody>
              </table>
            </div>
          `
          : html`
            <p class="muted">
              শিক্ষার্থী এখনো কোনো কোর্সে ভর্তি হয়নি।
            </p>
          `}
      </div>
    `);

    const submit = $('#enroll-submit', root);

    if (submit) {
      submit.addEventListener('click', async () => {
        const courseId = $('#enroll-course', root).value;

        if (!courseId) {
          return toast('একটি কোর্স নির্বাচন করুন।', 'err');
        }

        if (!(await confirmBox(
          'শিক্ষার্থীকে এই কোর্সে ভর্তি করবেন?',
          {
            danger: false,
            yes: 'ভর্তি করুন'
          }
        ))) return;

        btnBusy(submit, true, 'ভর্তি হচ্ছে…');

        try {
          const exists = enrolled.some(
            e => e.course_id === courseId
          );

          if (exists) {
            return toast(
              'শিক্ষার্থী ইতিমধ্যে এই কোর্সে ভর্তি আছে।',
              'err'
            );
          }

          must(
            await sb.from('enrollments')
              .insert({
                user_id: student.id,
                course_id: courseId
              })
          );

          toast('শিক্ষার্থী সফলভাবে ভর্তি হয়েছে।');

          await searchStudent();

        } catch (e) {
          toast(errMsg(e), 'err');
        } finally {
          btnBusy(submit, false);
        }
      });
    }
  };

  $('#enroll-search', root)
    .addEventListener('click', searchStudent);

  $('#enroll-phone', root)
    .addEventListener('keydown', e => {
      if (e.key === 'Enter') searchStudent();
    });
};

sections['inbox'] = async ({ root }) => {
  let student = null;
  let messages = [];

  put(root, html`
    <div class="toolbar">
      <h2>One Way Inbox</h2>
    </div>

    <div class="card pad">
      <div class="field">
        <label>শিক্ষার্থীর মোবাইল নম্বর</label>

        <div class="row gap">
          <input id="inbox-phone" type="tel"
            placeholder="মোবাইল নম্বর লিখুন"/>

          <button class="btn primary" id="inbox-search">
            খুঁজুন
          </button>
        </div>
      </div>
    </div>

    <div id="inbox-result" class="mt"></div>
  `);

  const searchStudent = async () => {
    const phone = $('#inbox-phone', root).value.trim();

    if (!phone) {
      return toast('মোবাইল নম্বর লিখুন।', 'err');
    }

    const btn = $('#inbox-search', root);
    btnBusy(btn, true, 'খোঁজা হচ্ছে…');

    try {
      student = null;
      messages = [];

      const profiles = must(
        await sb.from('profiles')
          .select('id,full_name,mobile,class_level,role')
          .ilike('mobile', `%${phone}%`)
          .eq('role', 'student')
          .limit(1)
      );

      if (!profiles.length) {
        put($('#inbox-result', root), html`
          <div class="card pad center">
            <h3>শিক্ষার্থী পাওয়া যায়নি</h3>
            <p class="muted">
              মোবাইল নম্বরটি পরীক্ষা করুন।
            </p>
          </div>
        `);
        return;
      }

      student = profiles[0];

      messages = must(
        await sb.from('inbox_messages')
          .select('*')
          .eq('user_id', student.id)
          .order('created_at', { ascending: false })
      );

      drawInbox();

    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      btnBusy(btn, false);
    }
  };

  const drawInbox = () => {
    put($('#inbox-result', root), html`
      <div class="card pad">
        <h3>শিক্ষার্থীর তথ্য</h3>

        <div class="grid g-stats">
          <div>
            <span class="muted">নাম</span>
            <b>${student.full_name || '—'}</b>
          </div>

          <div>
            <span class="muted">মোবাইল</span>
            <b>${student.mobile || '—'}</b>
          </div>

          <div>
            <span class="muted">শ্রেণি</span>
            <b>${student.class_level
              ? classLabel(student.class_level)
              : '—'}</b>
          </div>
        </div>
      </div>

      <div class="card pad mt">
        <h3>নতুন মেসেজ পাঠান</h3>

        <div class="field">
          <label>Subject</label>
          <input id="inbox-subject"
            placeholder="মেসেজের বিষয় লিখুন"/>
        </div>

        <div class="field">
          <label>Message</label>
          <textarea id="inbox-message"
            rows="5"
            placeholder="আপনার মেসেজ লিখুন"></textarea>
        </div>

        <button class="btn primary" id="inbox-send">
          মেসেজ পাঠান
        </button>
      </div>

      <div class="card pad mt">
        <h3>পাঠানো মেসেজ</h3>

        ${messages.length
          ? html`
            <div class="stack gap">
              ${messages.map(m => html`
                <div class="card pad">
                  <b>${m.subject}</b>

                  <p>${m.message}</p>

                  <div class="muted">
                    ${m.created_at
                      ? fmtDT(m.created_at)
                      : '—'}
                  </div>

                  <span class="badge">
                    ${m.is_read ? 'পড়া হয়েছে' : 'পড়া হয়নি'}
                  </span>
                </div>
              `)}
            </div>
          `
          : html`
            <p class="muted">
              এখনো কোনো মেসেজ পাঠানো হয়নি।
            </p>
          `}
      </div>
    `);

    $('#inbox-send', root).addEventListener(
      'click',
      async () => {
        const subject = $('#inbox-subject', root)
          .value.trim();

        const message = $('#inbox-message', root)
          .value.trim();

        if (!subject || !message) {
          return toast(
            'Subject ও Message দুটোই লিখুন।',
            'err'
          );
        }

        const btn = $('#inbox-send', root);
        btnBusy(btn, true, 'পাঠানো হচ্ছে…');

        try {
          must(
            await sb.from('inbox_messages')
              .insert({
                user_id: student.id,
                subject,
                message,
                sent_by: uid()
              })
          );

          toast('মেসেজ সফলভাবে পাঠানো হয়েছে।');

          await searchStudent();

        } catch (e) {
          toast(errMsg(e), 'err');
        } finally {
          btnBusy(btn, false);
        }
      }
    );
  };

  $('#inbox-search', root)
    .addEventListener('click', searchStudent);

  $('#inbox-phone', root)
    .addEventListener('keydown', e => {
      if (e.key === 'Enter') searchStudent();
    });
};

/* ==========================================
   MODERATOR PANEL - NEW SECTION PLACEHOLDERS
   Existing admin.js features remain untouched
========================================== */

const moderatorNewSections = [
  'videos',
  'menu',
  'subscriptions',
  'core',
  'misc',

  'content-review',
  'lesson-review',
  'notes-review',
  'pdf-review',
  'slides-review',
  'question-bank',
  'exam-review',
  'content-reports',

  'store-books',
  'store-slides',
  'store-products',
  'product-details',
  'stock',
  'order-status',
  'customer-support',

  'class-students',
  'group-students',
  'registration-report',
  'course-enrollment-report',
  'user-activity-report',

  'promo-codes',
  'campaigns',
  'banners',
  'referrals',
  'notification-campaigns',
  'marketing-review',

  'student-reports',
  'comment-reports',
  'spam',
  'inappropriate-content',
  'warnings',
  'content-hide',
  'admin-escalation',

  'tickets',
  'ticket-assign',
  'ticket-replies',
  'ticket-priority',
  'ticket-status',
  'complaint-history',

  'faq',
  'feedback',
  'app-notices',
  'help-articles',
  'error-reports',
  'general-settings',

  'activity-log'
];

// নতুন section-গুলোর জন্য প্রাথমিক পেজ
moderatorNewSections.forEach((sectionName) => {
  // আগে থেকে section থাকলে সেটি পরিবর্তন করা হবে না
  if (sections[sectionName]) return;

  sections[sectionName] = async ({ root }) => {
    put(
      root,
      html`
        <div class="card pad">
          <h2>মডারেটর ম্যানেজমেন্ট</h2>

          <p class="muted">
            এই ফিচারের পেজ তৈরি করার কাজ পরবর্তী ধাপে সম্পন্ন হবে।
          </p>

          <div class="notice">
            <strong>Classical Academy</strong>
            <p>
              এই অংশটি প্রস্তুত করা হচ্ছে।
              পরবর্তী আপডেটে এখানে ব্যবস্থাপনার সুবিধা যুক্ত হবে।
            </p>
          </div>

          <a class="btn primary" href="#/admin">
            ড্যাশবোর্ডে ফিরে যান
          </a>
        </div>
      `
    );
  };
});
