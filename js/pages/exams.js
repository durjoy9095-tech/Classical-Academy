// Student examination pages: list/history/performance, taking an exam, results.
import { html, put, icon, $, $$, errMsg, toast, must, bn, num, fmtDT, fmtDate, classLabel, groupLabel, EXAM_KINDS, empty, confirmBox, gradeOf, btnBusy } from '../lib.js';
import { sb, state, uid, logActivity } from '../db.js';
import { navigate } from '../router.js';
import { backLink, statusBadge } from '../components.js';

const pctOf = (a, ex) => ex?.total_marks > 0 ? (Number(a.total_score) / Number(ex.total_marks)) * 100 : 0;
const groupOk = (e, p) => !e.group_name || !p.group_name || e.group_name === p.group_name;

// ------------------------------------------------------------------ list
export async function examsList({ root, query }) {
  const p = state.profile;
  const tab = ['upcoming', 'history', 'perf'].includes(query.tab) ? query.tab : 'upcoming';
  const [exR, atR] = await Promise.all([
    sb.from('exams').select('*, subject:subjects(name)').eq('is_published', true).eq('class_level', p.class_level || 0).order('start_at', { nullsFirst: false }),
    sb.from('exam_attempts').select('*, exam:exams(title,total_marks,pass_marks,subject:subjects(name))').eq('user_id', uid()).order('started_at', { ascending: false }),
  ]);
  const exams = must(exR).filter((e) => groupOk(e, p)); const attempts = must(atR);
  const byExam = Object.fromEntries(attempts.map((a) => [a.exam_id, a]));
  const now = Date.now();

  put(root, html`<div class="section-head"><h2>পরীক্ষা</h2></div>
    <div class="tabs">${[['upcoming', 'পরীক্ষাসমূহ'], ['history', 'পরীক্ষার ইতিহাস'], ['perf', 'পারফরম্যান্স']].map(([k, v]) => html`<button class="tab ${tab === k ? 'active' : ''}" data-tab="${k}">${v}</button>`)}</div><div id="body"></div>`);
  $$('[data-tab]', root).forEach((b) => b.addEventListener('click', () => navigate(`/exams?tab=${b.dataset.tab}&keep=1`)));
  const body = $('#body', root);

  if (tab === 'upcoming') {
    put(body, exams.length ? html`<div class="grid g2">${exams.map((e) => {
      const a = byExam[e.id], st = e.start_at ? new Date(e.start_at).getTime() : 0, en = e.end_at ? new Date(e.end_at).getTime() : Infinity;
      let action;
      if (a && a.status !== 'in_progress') action = html`<a class="btn soft" href="#/result/${a.id}">ফলাফল দেখুন</a>`;
      else if (a) action = html`<a class="btn primary" href="#/exam/${e.id}">পরীক্ষা চালিয়ে যান</a>`;
      else if (now < st) action = html`<button class="btn soft" disabled>শুরু হবে ${fmtDT(e.start_at)}</button>`;
      else if (now > en) action = html`<span class="badge err">সময় শেষ – অংশ নেননি</span>`;
      else action = html`<a class="btn primary" href="#/exam/${e.id}">পরীক্ষা শুরু করুন</a>`;
      return html`<div class="card pad"><div class="row between"><span class="badge">${EXAM_KINDS[e.kind]}</span>${a ? statusBadge(a.status, { in_progress: 'চলছে', submitted: 'জমা হয়েছে', graded: 'ফল প্রকাশিত' }) : ''}</div>
        <h3 class="mt">${e.title}</h3>
        <div class="meta">${e.subject?.name ? html`<span>${icon('exam', 15)} ${e.subject.name}</span>` : ''}<span>${icon('clock', 15)} ${bn(e.duration_minutes)} মিনিট</span><span>পূর্ণমান ${num(e.total_marks)}</span></div>
        <div class="meta mt small">${e.start_at ? html`<span>শুরু: ${fmtDT(e.start_at)}</span>` : ''}${e.end_at ? html`<span>শেষ: ${fmtDT(e.end_at)}</span>` : ''}</div>
        <div class="mt">${action}</div></div>`; })}</div>` : html`<div class="card">${empty('আপনার শ্রেণির জন্য এখন কোনো পরীক্ষা নেই।', 'exam')}</div>`);
  } else if (tab === 'history') {
    put(body, attempts.length ? html`<div class="list">${attempts.map((a) => { const ex = a.exam; const pct = pctOf(a, ex);
      return html`<a class="li" href="${a.status === 'in_progress' ? `#/exam/${a.exam_id}` : `#/result/${a.id}`}"><div class="ico-box">${icon('exam', 22)}</div><div class="grow"><h4>${ex?.title}</h4>
        <p class="muted small">${fmtDate(a.started_at)} · ${a.status === 'graded' ? `${num(a.total_score)}/${num(ex.total_marks)} · গ্রেড ${gradeOf(pct).g}` : a.status === 'submitted' ? 'মূল্যায়নাধীন' : 'চলমান'}</p></div>
        ${statusBadge(a.status, { in_progress: 'চলছে', submitted: 'জমা হয়েছে', graded: 'ফল প্রকাশিত' })}</a>`; })}</div>` : html`<div class="card">${empty('আপনি এখনো কোনো পরীক্ষায় অংশ নেননি।', 'exam')}</div>`);
  } else {
    const graded = attempts.filter((a) => a.status === 'graded' && a.exam?.total_marks > 0);
    if (!graded.length) return put(body, html`<div class="card">${empty('পারফরম্যান্স রিপোর্ট দেখতে অন্তত একটি পরীক্ষার ফল প্রকাশিত হতে হবে।', 'chart')}</div>`);
    const pcts = graded.map((a) => pctOf(a, a.exam));
    const avg = pcts.reduce((s, x) => s + x, 0) / pcts.length;
    const bySubj = {};
    graded.forEach((a) => { const k = a.exam.subject?.name || 'অন্যান্য'; (bySubj[k] ||= []).push(pctOf(a, a.exam)); });
    const last = graded.slice(0, 8).reverse();
    put(body, html`<div class="grid g-stats"><div class="card stat"><b>${num(graded.length)}</b><span>ফল প্রকাশিত পরীক্ষা</span></div>
      <div class="card stat"><b>${num(Math.round(avg))}%</b><span>গড় নম্বর</span></div><div class="card stat"><b>${num(Math.round(Math.max(...pcts)))}%</b><span>সর্বোচ্চ</span></div>
      <div class="card stat"><b>${gradeOf(avg).g}</b><span>গড় গ্রেড</span></div></div>
      <div class="card pad mt"><h3>সাম্প্রতিক ফলাফল (%)</h3><div class="bars" style="margin-top:1.4rem">${last.map((a) => html`<div style="height:${Math.max(4, pctOf(a, a.exam))}%" title="${a.exam.title}"><span>${bn(Math.round(pctOf(a, a.exam)))}</span></div>`)}</div></div>
      <div class="card pad mt"><h3>বিষয়ভিত্তিক গড়</h3>${Object.entries(bySubj).map(([k, v]) => { const m = Math.round(v.reduce((s, x) => s + x, 0) / v.length);
        return html`<div class="mb"><div class="row between small"><span>${k}</span><b>${bn(m)}%</b></div><div class="progress"><i style="width:${m}%"></i></div></div>`; })}</div>`);
  }
}

// ------------------------------------------------------------------ take
export async function takeExam({ root, params, stale }) {
  const id = params.id, p = state.profile;
  const ex = must(await sb.from('exams').select('*, subject:subjects(name)').eq('id', id).maybeSingle());
  if (!ex || (ex.class_level !== p.class_level && p.role === 'student')) return put(root, html`${backLink('/exams')}<div class="card">${empty('পরীক্ষাটি পাওয়া যায়নি।', 'exam')}</div>`);
  const prev = must(await sb.from('exam_attempts').select('*').eq('exam_id', id).eq('user_id', uid()).maybeSingle());
  if (prev && prev.status !== 'in_progress') return navigate(`/result/${prev.id}`);

  const begin = async () => {
    const r = must(await sb.rpc('start_exam', { p_exam: id }));
    logActivity('exam_start', { exam: ex.title });
    run(r.attempt, r.duration_minutes, new Date(r.server_now).getTime() - Date.now());
  };

  if (prev) return begin();
  const nowMs = Date.now(), st = ex.start_at ? new Date(ex.start_at).getTime() : 0, en = ex.end_at ? new Date(ex.end_at).getTime() : Infinity;
  put(root, html`${backLink('/exams')}<div class="card pad center"><span class="badge">${EXAM_KINDS[ex.kind]}</span><h2 class="mt">${ex.title}</h2>
    <div class="meta" style="justify-content:center"><span>${icon('clock', 15)} সময়: ${bn(ex.duration_minutes)} মিনিট</span><span>পূর্ণমান: ${num(ex.total_marks)}</span>${ex.pass_marks ? html`<span>পাস নম্বর: ${num(ex.pass_marks)}</span>` : ''}</div>
    <ul style="text-align:left;max-width:460px;margin:1rem auto" class="muted"><li>শুরু করার পর সময় থামবে না, পেজ বন্ধ করলেও ঘড়ি চলবে।</li><li>সময় শেষ হলে উত্তর স্বয়ংক্রিয়ভাবে জমা হবে।</li><li>একবার জমা দিলে আর পরিবর্তন করা যাবে না এবং পরীক্ষা পুনরায় দেওয়া যাবে না।</li></ul>
    ${nowMs < st ? html`<p class="alert info">পরীক্ষা শুরু হবে ${fmtDT(ex.start_at)}।</p>` : nowMs > en ? html`<p class="alert err">পরীক্ষার সময় শেষ হয়ে গেছে।</p>` : html`<button class="btn primary" id="go">পরীক্ষা শুরু করুন</button>`}</div>`);
  $('#go', root)?.addEventListener('click', async (e) => {
    btnBusy(e.currentTarget, true, ' শুরু হচ্ছে…');
    try { await begin(); } catch (err) { toast(errMsg(err), 'err'); btnBusy(e.target, false); }
  });

  async function run(attempt, minutes, offset) {
    const qs = must(await sb.from('questions_public').select('*').eq('exam_id', id).order('position'));
    const LS = `ca_ans_${attempt.id}`;
    let answers = {}; try { answers = JSON.parse(localStorage.getItem(LS) || '{}'); } catch { /* ignore */ }
    const endAt = new Date(attempt.started_at).getTime() + minutes * 60000;
    let submitting = false, timer;
    const leave = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', leave);
    const cleanup = () => { clearInterval(timer); window.removeEventListener('beforeunload', leave); };

    put(root, html`<div class="exam-bar"><div><b>${ex.title}</b><div class="small muted">${bn(qs.length)} টি প্রশ্ন</div></div><div class="timer" id="timer">--:--</div></div>
      <form id="exam">${qs.length ? qs.map((q, i) => html`<div class="card q"><div><span class="qn">${bn(i + 1)}</span><b>${q.body}</b> <span class="badge">${num(q.marks)} নম্বর</span></div>
        ${q.kind === 'mcq' ? (q.options || []).map((o, k) => html`<label class="opt"><input type="radio" name="${q.id}" value="${k}" ${answers[q.id] === k ? 'checked' : ''}><span>${o}</span></label>`)
          : html`<textarea name="${q.id}" class="mt" placeholder="এখানে উত্তর লিখুন…" rows="5">${answers[q.id] || ''}</textarea>`}</div>`)
        : empty('এই পরীক্ষায় কোনো প্রশ্ন যোগ করা হয়নি।', 'exam')}
        <button class="btn primary block" type="submit">উত্তর জমা দিন</button></form>`);
    const form = $('#exam', root);
    const collect = () => { const a = {}; qs.forEach((q) => {
      if (q.kind === 'mcq') { const c = form.querySelector(`input[name="${q.id}"]:checked`); if (c) a[q.id] = Number(c.value); }
      else { const t = form.elements[q.id]?.value?.trim(); if (t) a[q.id] = t; } }); return a; };
    const save = () => { try { localStorage.setItem(LS, JSON.stringify(collect())); } catch { /* quota */ } };
    form.addEventListener('input', save); form.addEventListener('change', save);

    const submit = async (auto) => {
      if (submitting) return; submitting = true;
      const btn = $('button[type=submit]', form); btnBusy(btn, true, ' জমা হচ্ছে…');
      try {
        const res = must(await sb.rpc('submit_exam', { p_attempt: attempt.id, p_answers: collect() }));
        localStorage.removeItem(LS); cleanup(); logActivity('exam_submit', { exam: ex.title });
        toast(auto ? 'সময় শেষ – উত্তর জমা হয়েছে।' : 'উত্তর জমা হয়েছে।'); navigate(`/result/${res.id}`);
      } catch (err) {
        submitting = false; btnBusy(btn, false);
        if (/already submitted/i.test(err.message)) { cleanup(); return navigate(`/result/${attempt.id}`); }
        toast(errMsg(err), 'err'); if (auto) setTimeout(() => submit(true), 4000);
      }
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const answered = Object.keys(collect()).length;
      if (await confirmBox(`আপনি ${bn(qs.length)} টির মধ্যে ${bn(answered)} টি প্রশ্নের উত্তর দিয়েছেন। জমা দিতে চান?`, { yes: 'জমা দিন', danger: false })) submit(false);
    });
    const tick = () => {
      if (stale()) return cleanup();
      const left = Math.max(0, endAt - (Date.now() + offset)), s = Math.floor(left / 1000);
      const el = $('#timer', root); if (!el) return cleanup();
      el.textContent = bn(`${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`);
      el.classList.toggle('low', s < 300);
      if (left <= 0) { clearInterval(timer); submit(true); }
    };
    tick(); timer = setInterval(tick, 1000);
  }
}

// ------------------------------------------------------------------ result
export async function result({ root, params }) {
  const a = must(await sb.from('exam_attempts').select('*, exam:exams(*, subject:subjects(name))').eq('id', params.id).eq('user_id', uid()).maybeSingle());
  if (!a) return put(root, html`${backLink('/exams')}<div class="card">${empty('ফলাফল পাওয়া যায়নি।', 'chart')}</div>`);
  if (a.status === 'in_progress') return navigate(`/exam/${a.exam_id}`);
  const ex = a.exam, total = Number(ex.total_marks), pct = pctOf(a, ex), gr = gradeOf(pct);
  const graded = a.status === 'graded', passed = Number(a.total_score) >= Number(ex.pass_marks);
  let review = [];
  try { review = must(await sb.rpc('exam_review', { p_attempt: a.id })); } catch { /* optional */ }

  put(root, html`${backLink('/exams?tab=history', 'পরীক্ষার ইতিহাস')}
    <div class="card pad center"><h2>${ex.title}</h2><p class="muted">${ex.subject?.name || ''} · ${fmtDT(a.submitted_at)}</p>
      ${graded ? html`<div class="score-ring" style="--pct:${Math.round(pct)}"><div><div><b>${num(a.total_score)}</b><div class="small muted">/ ${num(total)}</div></div></div></div>
        <div class="row gap wrap" style="justify-content:center"><span class="badge" style="font-size:1rem">গ্রেড ${gr.g}</span><span class="badge">GPA ${gr.gp}</span><span class="badge ${passed ? 'ok' : 'err'}" style="font-size:1rem">${passed ? 'উত্তীর্ণ' : 'অনুত্তীর্ণ'}</span><span class="badge">${bn(Math.round(pct))}%</span></div>`
        : html`<div class="score-ring" style="--pct:0"><div><div><b>${num(a.mcq_score)}</b><div class="small muted">এমসিকিউ</div></div></div></div>
        <p class="alert info">আপনার লিখিত উত্তর শিক্ষক মূল্যায়ন করছেন। চূড়ান্ত ফলাফল প্রকাশিত হলে এখানে দেখতে পাবেন।</p>`}
      ${graded && a.written_score != null && Number(a.written_score) > 0 ? html`<p class="muted small">এমসিকিউ: ${num(a.mcq_score)} · লিখিত: ${num(a.written_score)}</p>` : ''}</div>
    ${review.length ? html`<div class="section"><h2>উত্তরপত্র পর্যালোচনা</h2>${review.map((q, i) => { const mine = a.answers?.[q.id];
      return html`<div class="card q"><span class="qn">${bn(i + 1)}</span><b>${q.body}</b> <span class="badge">${num(q.marks)} নম্বর</span>
        ${q.kind === 'mcq' ? (q.options || []).map((o, k) => html`<div class="opt ${k === q.correct_index ? 'right' : (k === mine ? 'wrong' : '')}">${k === q.correct_index ? '✓' : k === mine ? '✗' : '○'} ${o}${k === mine ? html` <span class="badge">আপনার উত্তর</span>` : ''}</div>`)
          : html`<div class="opt" style="display:block"><div class="small muted">আপনার উত্তর:</div>${mine ? html`<div style="white-space:pre-line">${mine}</div>` : html`<i class="muted">উত্তর দেননি</i>`}</div>`}
        ${q.kind === 'mcq' && mine == null ? html`<p class="small muted mt">উত্তর দেননি।</p>` : ''}</div>`; })}</div>` : ''}`);
}
