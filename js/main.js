// Classical Academy - application entry point.
import { html, put, icon, logoMark, $, toast } from './lib.js';
import { configured, initBackend, state, isStaff, signOut, onAuth } from './db.js';
import { route, navigate, render, startRouter, resetShell } from './router.js';
import * as pub from './pages/public.js';
import * as stu from './pages/student.js';
import * as exm from './pages/exams.js';
import * as prf from './pages/profile.js';
import * as adm from './pages/admin.js';
import { bioEnabledFor, isUnlocked, bioVerify } from './biometric.js';

const A = { auth: true, layout: 'student' };
const ADM = { auth: true, layout: 'admin', roles: ['super_admin', 'admin', 'moderator', 'teacher'] };

// public
route('/', pub.welcome, { layout: 'public' });
route('/login', pub.login, { layout: 'public', guestOnly: true, adminHome: true });
route('/register', pub.register, { layout: 'public', guestOnly: true });
route('/forgot', pub.forgot, { layout: 'public', guestOnly: true });
route('/reset-password', pub.resetPassword, { layout: 'public' });
route('/complete-profile', pub.completeProfile, { layout: 'public', auth: true });
// student
route('/home', stu.home, A);
route('/courses', stu.courses, A);
route('/course/:id', stu.course, A);
route('/store', stu.store, A);
route('/store/:id', stu.product, A);
route('/cart', stu.cart, A);
route('/order/:id', stu.order, A);
route('/library', stu.library, A);
route('/exams', exm.examsList, A);
route('/exam/:id', exm.takeExam, A);
route('/result/:id', exm.result, A);
route('/profile', prf.profile, A);
route('/profile/edit', prf.editProfile, A);
route('/profile/security', prf.security, A);
route('/profile/bookmarks', prf.bookmarks, A);
route('/profile/devices', prf.devices, A);
route('/profile/activity', prf.activity, A);
route('/profile/orders', prf.orders, A);
route('/profile/support', prf.support, A);
route('/profile/doubt', prf.doubt, A);
route('/profile/offline', prf.offline, A);
route('/profile/biometric', prf.biometric, A);
route('/profile/ai-tutor', prf.aiTutor, A);
// admin
route('/admin', adm.adminHome, ADM);
route('/admin/lessons/:id', adm.lessonsPage, { ...ADM, roles: ['super_admin', 'admin', 'teacher'] });
route('/admin/questions/:id', adm.questionsPage, { ...ADM, roles: ['super_admin', 'admin', 'teacher'] });
route('/admin/course-students/:id', adm.courseStudents, { ...ADM, roles: ['super_admin', 'admin', 'teacher'] });
route('/admin/results', adm.resultsPage, { ...ADM, roles: ['super_admin', 'admin', 'teacher'] });
route('/admin/:section', adm.adminSection, ADM);

function lockScreen() {
  put($('#app'), html`<div class="auth-page"><div class="card auth-card pad center">${logoMark('lg')}<h1 class="mt">অ্যাপ লক করা আছে</h1>
    <p class="muted">চালিয়ে যেতে আপনার ফিঙ্গারপ্রিন্ট / ফেস / স্ক্রিন লক দিয়ে যাচাই করুন।</p>
    <button class="btn primary block" id="unlock">${icon('fingerprint', 20)} আনলক করুন</button>
    <button class="btn ghost block mt" id="out">অন্য অ্যাকাউন্টে লগইন</button></div></div>`);
  $('#unlock').addEventListener('click', async () => {
    try { await bioVerify(); startRouter(); } catch { toast('যাচাই করা যায়নি।', 'err'); }
  });
  $('#out').addEventListener('click', async () => { await signOut(); startRouter(); });
}

async function boot() {
  const urlErr = new URLSearchParams(location.search).get('error_description');
  if (!configured) { startRouterSetup(); return; }
  try {
    await initBackend();
  } catch (e) {
    console.error(e);
    put($('#app'), html`<div class="center-screen"><h2>সংযোগ করা যায়নি</h2><p class="muted">ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।</p><button class="btn primary" onclick="location.reload()">রিলোড</button></div>`);
    return;
  }
  onAuth((evt) => {
    resetShell();
    if (evt === 'signed_out') return navigate('/');
    const p = (location.hash.slice(1) || '/').split('?')[0];
    if (['/', '/login', '/register', '/forgot'].includes(p)) navigate(isStaff() ? '/admin' : '/home'); else render();
  });
  if (state.session && bioEnabledFor(state.session.user.id) && !isUnlocked(state.session.user.id)) lockScreen();
  else startRouter();
  if (urlErr) setTimeout(() => toast(urlErr.replace(/\+/g, ' '), 'err'), 400);
}

function startRouterSetup() { pub.setupScreen({ root: $('#app') }); }

boot();
