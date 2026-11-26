// Student pages: dashboard, courses, course player, store, cart, library.
import { html, put, icon, $, $$, errMsg, toast, must, money, bn, num, fmtDT, fmtDate, classLabel, groupLabel, PRODUCT_KINDS, ORDER_STATUS, PAY_METHODS,
  safeUrl, ytEmbed, empty, debounce, formObj, btnBusy, confirmBox, gradeOf, raw } from '../lib.js';
import { sb, state, uid, getSetting, logActivity, signedUrl, getBookmarkSet, toggleBookmark } from '../db.js';
import { navigate } from '../router.js';
import { courseCard, productCard, thumb, avatar, backLink, statusBadge } from '../components.js';
import { saveOffline, isOffline, offlineSupported } from '../offline.js';

const groupOk = (item, p) => !item.group_name || !p.group_name || item.group_name === p.group_name;

// ------------------------------------------------------------------ data helpers
async function myEnrollments() {
  const rows = must(await sb.from('enrollments').select('course_id, created_at, course:courses(*, teacher:teachers(full_name), subject:subjects(name))').eq('user_id', uid()));
  return rows.filter((r) => r.course);
}
async function progressMap(courseIds) {
  if (!courseIds.length) return {};
  const [ls, done] = await Promise.all([
    sb.from('lessons').select('id,course_id').in('course_id', courseIds),
    sb.from('lesson_progress').select('lesson_id').eq('user_id', uid()),
  ]);
  const doneSet = new Set((done.data || []).map((d) => d.lesson_id));
  const out = {};
  courseIds.forEach((id) => { out[id] = { total: 0, done: 0 }; });
  (ls.data || []).forEach((l) => { out[l.course_id].total++; if (doneSet.has(l.id)) out[l.course_id].done++; });
  Object.values(out).forEach((o) => { o.pct = o.total ? Math.round((o.done / o.total) * 100) : 0; });
  return out;
}
async function ownedProductIds() {
  const rows = must(await sb.from('order_items').select('product_id, orders!inner(status,user_id)').eq('orders.status', 'paid').eq('orders.user_id', uid()));
  return new Set(rows.map((r) => r.product_id));
}
async function cartCount() {
  const { count } = await sb.from('cart_items').select('*', { count: 'exact', head: true }).eq('user_id', uid());
  return count || 0;
}

// ------------------------------------------------------------------ dashboard
export async function home({ root }) {
  const p = state.profile, nowISO = new Date().toISOString();
  const [enr, anns, att, exams] = await Promise.all([
    myEnrollments(),
    sb.from('announcements').select('*').eq('is_published', true).order('created_at', { ascending: false }).limit(4),
    sb.from('exam_attempts').select('*, exam:exams(title,total_marks,pass_marks)').eq('user_id', uid()).order('started_at', { ascending: false }),
    sb.from('exams').select('*, subject:subjects(name)').eq('is_published', true).eq('class_level', p.class_level || 0).or(`end_at.is.null,end_at.gt.${nowISO}`).order('start_at', { nullsFirst: false }).limit(20),
  ]);
  const ids = enr.map((e) => e.course_id);
  const prog = await progressMap(ids);
  let live = [];
  if (ids.length) {
    const since = new Date(Date.now() - 2 * 3600e3).toISOString();
    live = must(await sb.from('lessons').select('id,title,live_at,video_url,course_id').in('course_id', ids).eq('kind', 'live').gte('live_at', since).order('live_at').limit(5));
  }
  const attempted = new Set((att.data || []).map((a) => a.exam_id));
  const upcoming = (exams.data || []).filter((e) => groupOk(e, p) && !attempted.has(e.id)).slice(0, 4);
  const results = (att.data || []).filter((a) => a.status !== 'in_progress' && a.exam).slice(0, 4);
  const lessonsDone = Object.values(prog).reduce((s, o) => s + o.done, 0);
  const graded = (att.data || []).filter((a) => a.status === 'graded' && a.exam?.total_marks > 0);
  const avg = graded.length ? Math.round(graded.reduce((s, a) => s + (a.total_score / a.exam.total_marks) * 100, 0) / graded.length) : null;
  const hr = new Date().getHours();
  const hello = hr < 5 ? 'শুভ রাত্রি' : hr < 12 ? 'শুভ সকাল' : hr < 16 ? 'শুভ দুপুর' : hr < 19 ? 'শুভ বিকাল' : 'শুভ সন্ধ্যা';

  put(root, html`
    <div class="greet">${avatar(p.avatar_url, p.full_name, 'lg')}
      <div><p>${hello}!</p><h2>স্বাগতম, ${p.full_name}</h2>
        <p>${classLabel(p.class_level)}${p.group_name ? ' · ' + groupLabel(p.group_name) : ''} · @${p.username || ''}</p></div></div>

    <div class="grid g-stats section">
      <div class="card stat"><b>${num(enr.length)}</b><span>ভর্তি করা কোর্স</span></div>
      <div class="card stat"><b>${num(lessonsDone)}</b><span>সম্পন্ন পাঠ</span></div>
      <div class="card stat"><b>${num(att.data?.length || 0)}</b><span>অংশ নেওয়া পরীক্ষা</span></div>
      <div class="card stat"><b>${avg == null ? '—' : num(avg) + '%'}</b><span>গড় ফলাফল</span></div>
    </div>

    <div class="section"><div class="quick">
      ${[['/courses', 'courses', 'কোর্স'], ['/store', 'store', 'স্টোর'], ['/library', 'library', 'লাইব্রেরি'], ['/exams', 'exam', 'পরীক্ষা'], ['/profile/doubt', 'help', 'ডাউট সলভ'], ['/profile/bookmarks', 'bookmark', 'বুকমার্ক']]
        .map(([to, ic, t]) => html`<a href="#${to}">${icon(ic, 26)}<span>${t}</span></a>`)}</div></div>

    ${live.length ? html`<div class="section"><div class="section-head"><h2>লাইভ ক্লাস</h2></div><div class="list">
      ${live.map((l) => html`<a class="li" href="#/course/${l.course_id}"><div class="ico-box">${icon('live', 22)}</div><div class="grow"><h4>${l.title}</h4>
        <p class="muted small">${fmtDT(l.live_at)}</p></div><span class="badge ${new Date(l.live_at) <= new Date() ? 'err' : ''}">${new Date(l.live_at) <= new Date() ? '● লাইভ' : 'আসন্ন'}</span></a>`)}</div></div>` : ''}

    <div class="section"><div class="section-head"><h2>আমার কোর্স</h2><a href="#/courses">সব দেখুন</a></div>
      ${enr.length ? html`<div class="grid g2">${enr.slice(0, 4).map((e) => courseCard(e.course, { progress: prog[e.course_id]?.pct || 0 }))}</div>`
        : html`<div class="card">${empty('এখনো কোনো কোর্সে ভর্তি হননি।', 'courses')}<p class="center"><a class="btn primary" href="#/courses">কোর্স দেখুন</a></p><br></div>`}</div>

    <div class="two-col half">
      <div class="section"><div class="section-head"><h2>আসন্ন পরীক্ষা</h2><a href="#/exams">সব দেখুন</a></div>
        ${upcoming.length ? html`<div class="list">${upcoming.map((e) => html`<a class="li" href="#/exams"><div class="ico-box">${icon('exam', 22)}</div><div class="grow"><h4>${e.title}</h4>
          <p class="muted small">${e.start_at ? fmtDT(e.start_at) : 'যেকোনো সময়'} · ${bn(e.duration_minutes)} মিনিট</p></div></a>`)}</div>` : html`<div class="card">${empty('কোনো আসন্ন পরীক্ষা নেই।', 'exam')}</div>`}</div>
      <div class="section"><div class="section-head"><h2>সাম্প্রতিক ফলাফল</h2></div>
        ${results.length ? html`<div class="list">${results.map((a) => { const t = a.exam.total_marks; const pct = t ? Math.round((a.total_score / t) * 100) : 0;
          return html`<a class="li" href="#/result/${a.id}"><div class="ico-box">${icon('chart', 22)}</div><div class="grow"><h4>${a.exam.title}</h4>
          <p class="muted small">${a.status === 'graded' ? `${num(a.total_score)}/${num(t)} · গ্রেড ${gradeOf(pct).g}` : 'লিখিত খাতা মূল্যায়নাধীন'}</p></div></a>`; })}</div>` : html`<div class="card">${empty('এখনো কোনো ফলাফল নেই।', 'chart')}</div>`}</div>
    </div>

    <div class="section"><div class="section-head"><h2>ঘোষণা</h2></div>
      ${anns.data?.length ? html`<div class="list">${anns.data.map((a) => html`<div class="li"><div class="ico-box">${icon('bell', 20)}</div><div class="grow"><h4>${a.title}</h4>
        ${a.body ? html`<p class="muted small">${a.body}</p>` : ''}<span class="small muted">${fmtDate(a.created_at)}</span></div></div>`)}</div>` : html`<div class="card">${empty('কোনো নতুন ঘোষণা নেই।', 'bell')}</div>`}</div>`);
}

// ------------------------------------------------------------------ courses list
export async function courses({ root, query }) {
  const p = state.profile;
  let cls = Number(query.class) || p.class_level || 6;
  const tab = query.tab === 'all' ? 'all' : 'mine';
  const [enr, bm] = await Promise.all([myEnrollments(), getBookmarkSet()]);
  const enrolledIds = new Set(enr.map((e) => e.course_id));
  const prog = await progressMap([...enrolledIds]);

  put(root, html`
    <div class="section-head"><h2>কোর্স</h2></div>
    <div class="tabs"><button class="tab ${tab === 'mine' ? 'active' : ''}" data-tab="mine">আমার কোর্স (${num(enr.length)})</button>
      <button class="tab ${tab === 'all' ? 'active' : ''}" data-tab="all">সব কোর্স</button></div>
    <div id="filters" class="filters" ${tab === 'mine' ? 'hidden' : ''}>
      <div class="search">${icon('search', 18)}<input id="q" placeholder="কোর্স খুঁজুন…"></div>
      <select id="cls">${[6, 7, 8, 9, 10].map((c) => html`<option value="${c}" ${c === cls ? 'selected' : ''}>${classLabel(c)}</option>`)}</select>
      <select id="subj"><option value="">সব বিষয়</option></select></div>
    <div id="list"></div>`);

  $$('[data-tab]', root).forEach((b) => b.addEventListener('click', () => navigate(`/courses?tab=${b.dataset.tab}&class=${cls}&keep=1`)));
  const list = $('#list', root);
  if (tab === 'mine') {
    put(list, enr.length ? html`<div class="grid g2">${enr.map((e) => courseCard(e.course, { progress: prog[e.course_id]?.pct || 0 }))}</div>`
      : html`<div class="card">${empty('আপনি এখনো কোনো কোর্সে ভর্তি হননি।', 'courses')}<p class="center"><button class="btn primary" data-tab2>সব কোর্স দেখুন</button></p><br></div>`);
    $('[data-tab2]', root)?.addEventListener('click', () => navigate('/courses?tab=all'));
    return;
  }
  const [cs, subs] = await Promise.all([
    sb.from('courses').select('*, teacher:teachers(full_name), subject:subjects(name)').eq('is_published', true).eq('class_level', cls).order('created_at', { ascending: false }).limit(200),
    sb.from('subjects').select('*').eq('class_level', cls).order('name'),
  ]);
  must(cs);
  const all = cs.data.filter((c) => groupOk(c, p) || cls !== p.class_level);
  $('#subj', root).insertAdjacentHTML('beforeend', (subs.data || []).map((s) => html`<option value="${s.id}">${s.name}</option>`.s).join(''));
  const draw = () => {
    const q = $('#q', root).value.trim().toLowerCase(), s = $('#subj', root).value;
    const rows = all.filter((c) => (!s || c.subject_id === s) && (!q || c.title.toLowerCase().includes(q)));
    put(list, rows.length ? html`<div class="grid g2">${rows.map((c) => courseCard(c, { enrolled: enrolledIds.has(c.id) }))}</div>` : empty('কোনো কোর্স পাওয়া যায়নি।', 'courses'));
  };
  $('#q', root).addEventListener('input', debounce(draw, 150)); $('#subj', root).addEventListener('change', draw);
  $('#cls', root).addEventListener('change', (e) => navigate(`/courses?tab=all&class=${e.target.value}&keep=1`));
  draw();
}

// ------------------------------------------------------------------ course detail + player
export async function course({ root, params, stale }) {
  const id = params.id;
  const c = must(await sb.from('courses').select('*, teacher:teachers(*), subject:subjects(name)').eq('id', id).maybeSingle());
  if (!c) return put(root, html`${backLink('/courses')}<div class="card">${empty('কোর্সটি পাওয়া যায়নি।', 'courses')}</div>`);
  const [enrR, lessonsR, doneR, prodR, bm] = await Promise.all([
    sb.from('enrollments').select('id').eq('user_id', uid()).eq('course_id', id).maybeSingle(),
    sb.from('lessons').select('*').eq('course_id', id).order('position').order('created_at'),
    sb.from('lesson_progress').select('lesson_id').eq('user_id', uid()),
    c.price > 0 ? sb.from('products').select('id').eq('course_id', id).eq('is_published', true).maybeSingle() : Promise.resolve({ data: null }),
    getBookmarkSet(),
  ]);
  const enrolled = !!enrR.data;
  const lessons = lessonsR.data || [];
  const done = new Set((doneR.data || []).map((d) => d.lesson_id));
  let active = lessons.find((l) => !done.has(l.id)) || lessons[0] || null;
  let bookmarked = bm.has(`course:${id}`);
  const t = c.teacher;

  const draw = () => {
    const pct = lessons.length ? Math.round((lessons.filter((l) => done.has(l.id)).length / lessons.length) * 100) : 0;
    put(root, html`
      ${backLink('/courses')}
      <div class="two-col side">
        <div>
          ${enrolled || active?.is_preview ? playerBlock(active, done) : html`<div class="thumb card" style="aspect-ratio:16/9;border-radius:var(--r)">${safeUrl(c.thumbnail_url) ? html`<img src="${safeUrl(c.thumbnail_url)}" alt="">` : icon('courses', 60)}</div>`}
          <div class="card pad mt">
            <div class="row between wrap gap"><h2 style="margin:0">${c.title}</h2>
              <button class="icon-btn" id="bm" aria-label="বুকমার্ক" style="${bookmarked ? 'background:var(--p600);color:#fff' : ''}">${icon('bookmark', 20)}</button></div>
            <div class="meta mt"><span>${classLabel(c.class_level)}</span>${c.group_name ? html`<span>· ${groupLabel(c.group_name)}</span>` : ''}${c.subject?.name ? html`<span>· ${c.subject.name}</span>` : ''}
              <span class="badge ${c.price > 0 ? '' : 'free'}">${money(c.price)}</span></div>
            ${c.description ? html`<p class="mt" style="white-space:pre-line">${c.description}</p>` : ''}
            ${enrolled ? html`<div class="mt"><div class="progress"><i style="width:${pct}%"></i></div><div class="meta small mt">অগ্রগতি: ${bn(pct)}% (${bn(done.size)}/${bn(lessons.length)} পাঠ)</div></div>` : ''}
            ${enrolled ? '' : enrollBox()}
            ${enrolled && c.price == 0 ? html`<p class="mt"><button class="linklike muted small" id="leave">কোর্স থেকে বের হন</button></p>` : ''}
          </div>
        </div>
        <div>
          <div class="card pad"><h3>পাঠসমূহ</h3>
            ${lessons.length ? html`<div class="list">${lessons.map((l, i) => html`<button class="lesson ${active?.id === l.id ? 'active' : ''} ${done.has(l.id) ? 'done' : ''}" data-l="${l.id}">
              <span class="ico-box">${done.has(l.id) ? icon('check', 18) : icon(l.kind === 'live' ? 'live' : l.kind === 'note' ? 'file' : 'video', 18)}</span>
              <span class="grow"><b>${bn(i + 1)}. ${l.title}</b>${l.kind === 'live' ? html`<br><span class="small muted">${fmtDT(l.live_at)}</span>` : ''}</span>
              ${l.is_preview && !enrolled ? html`<span class="badge free">ফ্রি প্রিভিউ</span>` : ''}</button>`)}</div>`
              : html`<p class="muted">${enrolled ? 'এই কোর্সে এখনো কোনো পাঠ যোগ করা হয়নি।' : 'ভর্তি হলে পাঠসমূহ দেখতে পাবেন।'}</p>`}
          </div>
          ${t ? html`<div class="card pad mt center"><h3>শিক্ষক</h3>${avatar(t.avatar_url, t.full_name, 'lg')}<b>${t.full_name}</b>
            <p class="muted small">${[t.subject, t.qualification].filter(Boolean).join(' · ')}</p>${t.experience ? html`<p class="small">অভিজ্ঞতা: ${t.experience}</p>` : ''}${t.bio ? html`<p class="small muted">${t.bio}</p>` : ''}</div>` : ''}
        </div>
      </div>`);
    wire();
  };

  const enrollBox = () => c.price > 0
    ? (prodR.data ? html`<div class="row gap wrap mt"><button class="btn primary" id="buy">${icon('cart', 18)} ${money(c.price)} – এখনই কিনুন</button><button class="btn soft" id="addcart">কার্টে যোগ করুন</button></div>`
      : html`<p class="alert info mt">এই কোর্সটি শীঘ্রই কেনার জন্য উপলব্ধ হবে।</p>`)
    : html`<div class="mt"><button class="btn primary" id="enroll">বিনামূল্যে ভর্তি হন</button></div>`;

  function playerBlock(l, doneSet) {
    if (!l) return html`<div class="card">${empty('কোনো পাঠ নেই।', 'video')}</div>`;
    const yt = ytEmbed(l.video_url), url = safeUrl(l.video_url);
    let body;
    if (l.kind === 'live') {
      const started = l.live_at && new Date(l.live_at) <= new Date();
      body = html`<div class="card pad center"><div class="ico-box" style="margin:0 auto .6rem;width:56px;height:56px">${icon('live', 28)}</div><h3>${l.title}</h3>
        <p class="muted">${l.live_at ? fmtDT(l.live_at) : 'সময় শীঘ্রই জানানো হবে'}</p>
        ${url ? html`<a class="btn primary" target="_blank" rel="noopener" href="${url}">${started ? '● লাইভ ক্লাসে যোগ দিন' : 'ক্লাসের লিঙ্ক খুলুন'}</a>` : html`<p class="small muted">লিঙ্ক এখনো যোগ করা হয়নি।</p>`}</div>`;
    } else if (l.kind === 'note') {
      body = html`<div class="card pad center"><div class="ico-box" style="margin:0 auto .6rem;width:56px;height:56px">${icon('file', 28)}</div><h3>${l.title}</h3>
        ${url ? html`<a class="btn primary" target="_blank" rel="noopener" href="${url}">নোট খুলুন</a>` : ''}</div>`;
    } else if (yt) body = html`<iframe class="player" src="${yt}" title="${l.title}" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    else if (url) body = html`<video class="player" controls controlslist="nodownload" src="${url}"></video>`;
    else body = html`<div class="card">${empty('ভিডিও লিঙ্ক যোগ করা হয়নি।', 'video')}</div>`;
    return html`${body}<div class="row between mt"><b>${l.title}</b>${enrolled ? html`<button class="btn ${doneSet.has(l.id) ? 'soft' : 'primary'} sm" id="mark">${doneSet.has(l.id) ? '✓ সম্পন্ন (বাতিল করুন)' : 'সম্পন্ন চিহ্নিত করুন'}</button>` : ''}</div>`;
  }

  function wire() {
    $$('[data-l]', root).forEach((b) => b.addEventListener('click', () => {
      active = lessons.find((l) => l.id === b.dataset.l); draw(); $('.player,.card.pad.center', root)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }));
    $('#mark', root)?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        if (done.has(active.id)) { must(await sb.from('lesson_progress').delete().eq('user_id', uid()).eq('lesson_id', active.id)); done.delete(active.id); }
        else { must(await sb.from('lesson_progress').upsert({ user_id: uid(), lesson_id: active.id })); done.add(active.id); logActivity('lesson_done', { lesson: active.title }); }
        draw();
      } catch (err) { toast(errMsg(err), 'err'); e.target.disabled = false; }
    });
    $('#bm', root)?.addEventListener('click', async () => {
      try { await toggleBookmark('course', id, !bookmarked); bookmarked = !bookmarked; draw(); toast(bookmarked ? 'বুকমার্ক করা হয়েছে।' : 'বুকমার্ক সরানো হয়েছে।'); } catch (err) { toast(errMsg(err), 'err'); }
    });
    $('#enroll', root)?.addEventListener('click', async (e) => {
      btnBusy(e.currentTarget, true, ' অপেক্ষা করুন…');
      const { error } = await sb.from('enrollments').insert({ user_id: uid(), course_id: id });
      if (error) { toast(errMsg(error), 'err'); return btnBusy(e.currentTarget, false); }
      logActivity('enroll', { course: c.title }); toast('কোর্সে ভর্তি সম্পন্ন হয়েছে!'); navigate(`/course/${id}?keep=1`);
    });
    $('#leave', root)?.addEventListener('click', async () => {
      if (!(await confirmBox('এই কোর্স থেকে বের হতে চান? আপনার অগ্রগতি থেকে যাবে।'))) return;
      const { error } = await sb.from('enrollments').delete().eq('user_id', uid()).eq('course_id', id);
      if (error) return toast(errMsg(error), 'err'); toast('কোর্স থেকে বের হয়েছেন।'); navigate('/courses');
    });
    const addCart = async (go) => {
      const { error } = await sb.from('cart_items').upsert({ user_id: uid(), product_id: prodR.data.id, qty: 1 });
      if (error) return toast(errMsg(error), 'err');
      toast('কার্টে যোগ হয়েছে।'); if (go) navigate('/cart');
    };
    $('#buy', root)?.addEventListener('click', () => addCart(true));
    $('#addcart', root)?.addEventListener('click', () => addCart(false));
  }
  draw();
}

// ------------------------------------------------------------------ store
export async function store({ root, query }) {
  const [prods, owned, enrolled, cnt] = await Promise.all([
    sb.from('products').select('*').eq('is_published', true).order('created_at', { ascending: false }),
    ownedProductIds(), myEnrollments(), cartCount(),
  ]);
  must(prods);
  const enrolledIds = new Set(enrolled.map((e) => e.course_id));
  const isOwned = (p) => owned.has(p.id) || (p.course_id && enrolledIds.has(p.course_id));
  let kind = query.kind || '';
  put(root, html`
    <div class="section-head"><h2>ডিজিটাল স্টোর</h2><a class="btn soft sm" href="#/cart">${icon('cart', 16)} কার্ট${cnt ? ` (${bn(cnt)})` : ''}</a></div>
    <div class="tabs" id="kinds"><button class="tab active" data-k="">সব</button>${Object.entries(PRODUCT_KINDS).map(([k, v]) => html`<button class="tab" data-k="${k}">${v}</button>`)}</div>
    <div class="filters"><div class="search">${icon('search', 18)}<input id="q" placeholder="পণ্য খুঁজুন…"></div></div><div id="list"></div>`);
  const list = $('#list', root);
  const draw = () => {
    const q = $('#q', root).value.trim().toLowerCase();
    const rows = prods.data.filter((p) => (!kind || p.kind === kind) && (!q || p.title.toLowerCase().includes(q)));
    put(list, rows.length ? html`<div class="grid g3">${rows.map((p) => productCard(p, isOwned(p)))}</div>` : empty('কোনো পণ্য পাওয়া যায়নি।', 'store'));
  };
  $$('#kinds .tab', root).forEach((b) => { b.classList.toggle('active', b.dataset.k === kind); b.addEventListener('click', () => { kind = b.dataset.k; $$('#kinds .tab', root).forEach((x) => x.classList.toggle('active', x === b)); draw(); }); });
  $('#q', root).addEventListener('input', debounce(draw, 150));
  draw();
}

export async function product({ root, params }) {
  const p = must(await sb.from('products').select('*').eq('id', params.id).maybeSingle());
  if (!p) return put(root, html`${backLink('/store')}<div class="card">${empty('পণ্যটি পাওয়া যায়নি।', 'store')}</div>`);
  const [owned, enrolled] = await Promise.all([ownedProductIds(), myEnrollments()]);
  const has = owned.has(p.id) || (p.course_id && enrolled.some((e) => e.course_id === p.course_id));
  put(root, html`${backLink('/store', 'স্টোরে ফিরুন')}
    <div class="two-col half"><div class="card">${thumb(p.image_url, 'store', 'sq')}</div>
      <div class="card pad"><span class="badge">${PRODUCT_KINDS[p.kind]}</span><h2 class="mt">${p.title}</h2>
        <div class="price" style="font-size:1.6rem">${money(p.price)}</div>
        ${p.description ? html`<p class="mt" style="white-space:pre-line">${p.description}</p>` : ''}
        <div class="row gap wrap mt">${has
          ? html`<span class="badge ok">✓ আপনার কেনা</span>${p.course_id ? html`<a class="btn primary" href="#/course/${p.course_id}">কোর্সে যান</a>` : p.file_path ? html`<a class="btn primary" href="#/library?tab=bought">লাইব্রেরিতে খুলুন</a>` : ''}`
          : html`<button class="btn primary" id="add">${icon('cart', 18)} কার্টে যোগ করুন</button><button class="btn soft" id="now">এখনই কিনুন</button>`}</div></div></div>`);
  const add = async (go) => {
    const { error } = await sb.from('cart_items').upsert({ user_id: uid(), product_id: p.id, qty: 1 });
    if (error) return toast(errMsg(error), 'err'); toast('কার্টে যোগ হয়েছে।'); if (go) navigate('/cart');
  };
  $('#add', root)?.addEventListener('click', () => add(false)); $('#now', root)?.addEventListener('click', () => add(true));
}

// ------------------------------------------------------------------ cart + checkout
export async function cart({ root }) {
  const [items, pay] = await Promise.all([
    sb.from('cart_items').select('qty, product:products(*)').eq('user_id', uid()),
    getSetting('payment'),
  ]);
  const rows = must(items).filter((i) => i.product && i.product.is_published);
  const total = rows.reduce((s, i) => s + Number(i.product.price) * i.qty, 0);
  const numbers = [['bkash', pay.bkash], ['nagad', pay.nagad], ['rocket', pay.rocket]].filter(([, v]) => v);
  put(root, html`${backLink('/store', 'স্টোরে ফিরুন')}<h2>আমার কার্ট</h2>
    ${rows.length ? html`
    <div class="two-col side"><div class="list">
      ${rows.map((i) => html`<div class="li">${thumb(i.product.image_url, 'store', '')}
        <div class="grow"><h4>${i.product.title}</h4><p class="muted small">${PRODUCT_KINDS[i.product.kind]} · ${money(i.product.price)}</p></div>
        ${i.product.kind === 'course' ? '' : html`<input type="number" min="1" max="20" value="${i.qty}" data-qty="${i.product.id}" style="width:64px" aria-label="পরিমাণ">`}
        <button class="icon-btn" data-rm="${i.product.id}" aria-label="সরান">${icon('trash', 18)}</button></div>`)}</div>
      <div class="card pad"><h3>অর্ডার সারাংশ</h3><div class="row between"><span>সর্বমোট</span><b class="price" style="font-size:1.4rem">${money(total)}</b></div>
        <form id="co" class="mt">
          ${total > 0 ? html`
            ${numbers.length ? html`<div class="alert info">${pay.note || ''}<br>${numbers.map(([k, v]) => html`<b>${PAY_METHODS[k]}:</b> ${v}<br>`)}</div>` : html`<div class="alert info">${pay.note || 'পেমেন্টের তথ্য শীঘ্রই যোগ করা হবে।'}</div>`}
            <div class="field"><label>পেমেন্ট মাধ্যম</label><select name="method" required>${Object.entries(PAY_METHODS).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select></div>
            <div class="field"><label>যে নম্বর থেকে পাঠিয়েছেন</label><input name="phone" inputmode="numeric" placeholder="01XXXXXXXXX"></div>
            <div class="field"><label>ট্রানজেকশন আইডি (TrxID)</label><input name="trx" required maxlength="40"></div>` : ''}
          <button class="btn primary block" type="submit">${total > 0 ? 'অর্ডার নিশ্চিত করুন' : 'বিনামূল্যে সংগ্রহ করুন'}</button>
        </form></div></div>` : html`<div class="card">${empty('আপনার কার্ট খালি।', 'cart')}<p class="center"><a class="btn primary" href="#/store">স্টোরে যান</a></p><br></div>`}`);
  $$('[data-rm]', root).forEach((b) => b.addEventListener('click', async () => {
    const { error } = await sb.from('cart_items').delete().eq('user_id', uid()).eq('product_id', b.dataset.rm);
    if (error) return toast(errMsg(error), 'err'); navigate('/cart?keep=1');
  }));
  $$('[data-qty]', root).forEach((i) => i.addEventListener('change', async () => {
    const q = Math.min(20, Math.max(1, parseInt(i.value, 10) || 1));
    const { error } = await sb.from('cart_items').update({ qty: q }).eq('user_id', uid()).eq('product_id', i.dataset.qty);
    if (error) return toast(errMsg(error), 'err'); navigate('/cart?keep=1');
  }));
  $('#co', root)?.addEventListener('submit', async (e) => {
    e.preventDefault(); const v = formObj(e.target); const btn = $('button[type=submit]', e.target);
    if (total > 0 && !(v.trx || '').trim()) return toast('ট্রানজেকশন আইডি দিন।', 'err');
    btnBusy(btn, true, ' অপেক্ষা করুন…');
    const { data, error } = await sb.rpc('checkout', { p_method: v.method || 'other', p_trx: v.trx || '', p_phone: v.phone || '' });
    if (error) { btnBusy(btn, false); return toast(errMsg(error), 'err'); }
    logActivity('order', { order: data }); navigate(`/order/${data}`);
  });
}

export async function order({ root, params }) {
  const o = must(await sb.from('orders').select('*, order_items(qty, price, product:products(title, kind, course_id)), payments(*)').eq('id', params.id).maybeSingle());
  if (!o) return put(root, html`${backLink('/profile/orders')}<div class="card">${empty('অর্ডার পাওয়া যায়নি।', 'receipt')}</div>`);
  const pay = o.payments?.[0];
  put(root, html`${backLink('/profile/orders', 'অর্ডার তালিকা')}
    <div class="card pad center"><div class="ico-box" style="margin:0 auto .6rem;width:64px;height:64px;border-radius:20px;background:${o.status === 'paid' ? '#dcfce7' : 'var(--p100)'};color:${o.status === 'paid' ? 'var(--ok)' : 'var(--p600)'}">${icon(o.status === 'paid' ? 'check' : 'clock', 32)}</div>
      <h2>${o.status === 'paid' ? 'ক্রয় সম্পন্ন হয়েছে!' : o.status === 'cancelled' ? 'অর্ডার বাতিল হয়েছে' : 'অর্ডার গ্রহণ করা হয়েছে'}</h2>
      <p class="muted">${o.status === 'pending' ? 'আপনার পেমেন্ট যাচাই করা হচ্ছে। যাচাই শেষ হলে কোর্স ও ফাইল আনলক হবে।' : o.status === 'paid' ? 'আপনার কোর্স ও ফাইল এখন ব্যবহারের জন্য প্রস্তুত।' : 'পেমেন্ট যাচাই করা যায়নি। প্রয়োজনে সাপোর্টে যোগাযোগ করুন।'}</p>
      <p>অর্ডার নং: <code>${o.id.slice(0, 8).toUpperCase()}</code> · ${statusBadge(o.status, ORDER_STATUS)}</p>
      <div class="list" style="text-align:left;max-width:520px;margin:1rem auto">${o.order_items.map((i) => html`<div class="li"><div class="grow"><h4>${i.product?.title}</h4><p class="muted small">পরিমাণ ${bn(i.qty)}</p></div><b>${money(i.price * i.qty)}</b></div>`)}
        <div class="row between pad"><b>মোট</b><b class="price">${money(o.total)}</b></div>
        ${pay && o.total > 0 ? html`<p class="small muted">${PAY_METHODS[pay.method] || ''} · TrxID: ${pay.trx_id}</p>` : ''}</div>
      <div class="row gap wrap" style="justify-content:center"><a class="btn primary" href="#/courses">আমার কোর্স</a><a class="btn soft" href="#/library?tab=bought">আমার ফাইল</a></div></div>`);
}

// ------------------------------------------------------------------ library
export async function library({ root, query }) {
  const p = state.profile;
  const tab = ['free', 'bought', 'marks'].includes(query.tab) ? query.tab : 'free';
  const [booksR, boughtR, subs, bm] = await Promise.all([
    sb.from('books').select('*, subject:subjects(name)').eq('is_published', true).order('created_at', { ascending: false }),
    sb.from('order_items').select('product:products(*), orders!inner(status,user_id)').eq('orders.status', 'paid').eq('orders.user_id', uid()),
    sb.from('subjects').select('*').order('name'), getBookmarkSet(),
  ]);
  must(booksR); must(boughtR);
  const books = booksR.data.map((b) => ({ ...b, _type: 'book' }));
  const seen = new Set();
  const bought = boughtR.data.map((r) => r.product).filter((x) => x && x.file_path && !seen.has(x.id) && seen.add(x.id))
    .map((x) => ({ id: x.id, title: x.title, author: PRODUCT_KINDS[x.kind], description: x.description, cover_url: x.image_url, file_path: x.file_path, _type: 'product' }));
  let cls = query.class || '';
  put(root, html`<div class="section-head"><h2>ডিজিটাল লাইব্রেরি</h2><a class="btn soft sm" href="#/profile/offline">${icon('offline', 16)} অফলাইন</a></div>
    <div class="tabs">${[['free', 'ফ্রি বই'], ['bought', `আমার কেনা (${bn(bought.length)})`], ['marks', 'বুকমার্ক']].map(([k, v]) => html`<button class="tab ${tab === k ? 'active' : ''}" data-tab="${k}">${v}</button>`)}</div>
    <div class="filters"><div class="search">${icon('search', 18)}<input id="q" placeholder="নাম বা লেখক দিয়ে খুঁজুন…"></div>
      <select id="cls"><option value="">সব শ্রেণি</option>${[6, 7, 8, 9, 10].map((c) => html`<option value="${c}" ${String(c) === String(cls || '') ? 'selected' : ''}>${classLabel(c)}</option>`)}</select>
      <select id="subj"><option value="">সব বিষয়</option>${(subs.data || []).map((s) => html`<option value="${s.id}">${s.name}${s.class_level ? ' (' + classLabel(s.class_level) + ')' : ''}</option>`)}</select></div>
    <div id="list"></div>`);
  $$('[data-tab]', root).forEach((b) => b.addEventListener('click', () => navigate(`/library?tab=${b.dataset.tab}&keep=1`)));
  if (!query.class && p.class_level && tab === 'free') { /* show all by default; student can filter */ }
  const list = $('#list', root);
  const src = tab === 'bought' ? bought : tab === 'marks' ? [...books, ...bought].filter((x) => bm.has(`${x._type}:${x.id}`)) : books;
  const draw = () => {
    const q = $('#q', root).value.trim().toLowerCase(), c = $('#cls', root).value, s = $('#subj', root).value;
    const rows = src.filter((b) => (!c || String(b.class_level) === c) && (!s || b.subject_id === s) && (!q || (b.title + ' ' + (b.author || '')).toLowerCase().includes(q)));
    put(list, rows.length ? html`<div class="grid g3">${rows.map((b) => html`<div class="card">${thumb(b.cover_url, 'library', 'sq')}
      <div class="item-body"><h3>${b.title}</h3><div class="meta">${b.author ? html`<span>${b.author}</span>` : ''}${b.class_level ? html`<span>· ${classLabel(b.class_level)}</span>` : ''}${b.subject?.name ? html`<span>· ${b.subject.name}</span>` : ''}</div>
        <div class="row gap wrap mt"><button class="btn primary sm" data-open="${b.id}">${icon('eye', 16)} খুলুন</button><button class="btn soft sm" data-dl="${b.id}">${icon('download', 16)}</button>
          <button class="btn soft sm" data-off="${b.id}" title="অফলাইনে সংরক্ষণ">${icon('offline', 16)}${isOffline(b.id) ? ' ✓' : ''}</button>
          <button class="btn ${bm.has(`${b._type}:${b.id}`) ? 'primary' : 'soft'} sm" data-bm="${b.id}" aria-label="বুকমার্ক">${icon('bookmark', 16)}</button></div></div></div>`)}</div>` : empty(tab === 'free' ? 'কোনো বই পাওয়া যায়নি।' : tab === 'bought' ? 'আপনি এখনো কোনো ফাইল কেনেননি।' : 'কোনো বুকমার্ক নেই।', 'library'));
    const find = (id) => src.find((x) => x.id === id);
    $$('[data-open]', list).forEach((b) => b.addEventListener('click', async () => {
      const w = window.open('about:blank', '_blank');
      try { const u = await signedUrl(find(b.dataset.open).file_path); if (w) w.location.href = u; else location.href = u; logActivity('open_file', { title: find(b.dataset.open).title }); }
      catch (e) { w?.close(); toast(errMsg(e), 'err'); }
    }));
    $$('[data-dl]', list).forEach((b) => b.addEventListener('click', async () => {
      const f = find(b.dataset.dl);
      try { const ext = (f.file_path.split('.').pop() || 'pdf').slice(0, 5); const a = document.createElement('a'); a.href = await signedUrl(f.file_path, 300, `${f.title}.${ext}`); a.rel = 'noopener'; document.body.append(a); a.click(); a.remove(); }
      catch (e) { toast(errMsg(e), 'err'); }
    }));
    $$('[data-off]', list).forEach((b) => b.addEventListener('click', async () => {
      if (!offlineSupported()) return toast('এই ব্রাউজারে অফলাইন সংরক্ষণ সমর্থিত নয়।', 'err');
      const f = find(b.dataset.off); b.disabled = true;
      try { await saveOffline({ id: f.id, title: f.title, path: f.file_path }); toast('অফলাইনে সংরক্ষিত হয়েছে।'); b.innerHTML = icon('offline', 16).s + ' ✓'; }
      catch (e) { toast(errMsg(e), 'err'); } b.disabled = false;
    }));
    $$('[data-bm]', list).forEach((b) => b.addEventListener('click', async () => {
      const f = find(b.dataset.bm), k = `${f._type}:${f.id}`, on = !bm.has(k);
      try { await toggleBookmark(f._type, f.id, on); on ? bm.add(k) : bm.delete(k); if (tab === 'marks' && !on) return navigate('/library?tab=marks&keep=1'); draw(); } catch (e) { toast(errMsg(e), 'err'); }
    }));
  };
  ['#q'].forEach((s) => $(s, root).addEventListener('input', debounce(draw, 150))); $('#cls', root).addEventListener('change', draw); $('#subj', root).addEventListener('change', draw);
  draw();
}
