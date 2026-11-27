// Hash router + layout shells (public / student / admin).
import {
  html, put, icon, logoMark, $, $$, errMsg, skeleton
} from './lib.js';

import {
  state, role, isStaff, signOut, onAuth
} from './db.js';

import { studentInbox } from './student-inbox.js';

const routes = [];

export function route(pattern, handler, opts = {}) {
  const keys = [];

  const re = new RegExp(
    '^' +
      pattern.replace(/:[a-zA-Z]+/g, (m) => {
        keys.push(m.slice(1));
        return '([^/]+)';
      }) +
      '/?$'
  );

  routes.push({ re, keys, handler, opts });
}

// Student message inbox route
route('/messages', studentInbox, {
  auth: true,
  layout: 'student'
});

export const navigate = (path) => {
  if (location.hash === '#' + path) {
    render();
  } else {
    location.hash = '#' + path;
  }
};

let token = 0;
let shellKey = '';
let routerStarted = false;

const app = () => document.getElementById('app');

export const STUDENT_NAV = [
  {
    to: '/home',
    label: 'হোম',
    ic: 'home',
    match: /^\/home/
  },
  {
    to: '/courses',
    label: 'কোর্স',
    ic: 'courses',
    match: /^\/courses/
  },
  {
    to: '/store',
    label: 'স্টোর',
    ic: 'store',
    match: /^\/(store|cart|order)/
  },
  {
    to: '/library',
    label: 'লাইব্রেরি',
    ic: 'library',
    match: /^\/library/
  },
  {
    to: '/exams',
    label: 'পরীক্ষা',
    ic: 'exam',
    match: /^\/(exams|exam|result)/
  },
  {
    to: '/profile',
    label: 'প্রোফাইল',
    ic: 'user',
    match: /^\/profile/
  }
];

// Role constants
const ALL_STAFF = [
  'super_admin',
  'admin',
  'moderator',
  'teacher'
];

const ADMIN_ONLY = [
  'super_admin',
  'admin'
];

const MODERATOR_ROLES = [
  'super_admin',
  'admin',
  'moderator'
];

export const ADMIN_NAV = [
  // Dashboard
  {
    to: '/admin',
    label: 'ড্যাশবোর্ড',
    ic: 'grid',
    roles: ALL_STAFF
  },

  // Existing management pages
  {
    to: '/admin/users',
    label: 'ব্যবহারকারী',
    ic: 'users',
    roles: ADMIN_ONLY
  },
  {
    to: '/admin/teachers',
    label: 'শিক্ষক',
    ic: 'user',
    roles: ADMIN_ONLY
  },
  {
    to: '/admin/subjects',
    label: 'বিষয়',
    ic: 'tag',
    roles: ADMIN_ONLY
  },
  {
    to: '/admin/courses',
    label: 'কোর্স',
    ic: 'courses',
    roles: ['super_admin', 'admin', 'teacher']
  },
  {
    to: '/admin/exams',
    label: 'পরীক্ষা',
    ic: 'exam',
    roles: ['super_admin', 'admin', 'teacher']
  },
  {
    to: '/admin/results',
    label: 'ফলাফল',
    ic: 'chart',
    roles: ['super_admin', 'admin', 'teacher']
  },
  {
    to: '/admin/books',
    label: 'লাইব্রেরি বই',
    ic: 'library',
    roles: ADMIN_ONLY
  },
  {
    to: '/admin/products',
    label: 'স্টোর পণ্য',
    ic: 'store',
    roles: ADMIN_ONLY
  },
  {
    to: '/admin/orders',
    label: 'অর্ডার',
    ic: 'receipt',
    roles: ADMIN_ONLY
  },
  {
    to: '/admin/payments',
    label: 'পেমেন্ট',
    ic: 'tag',
    roles: ADMIN_ONLY
  },
  {
    to: '/admin/announcements',
    label: 'ঘোষণা',
    ic: 'bell',
    roles: MODERATOR_ROLES
  },

  // Academic Management
  {
    to: '/admin/free-trial',
    label: 'ফ্রি ট্রায়াল সাবস্ক্রিপশন',
    ic: 'book-open',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/enrollment',
    label: 'শিক্ষার্থী ভর্তি',
    ic: 'users',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/inbox',
    label: 'One Way Inbox',
    ic: 'mail',
    roles: MODERATOR_ROLES
  },

  // Video Management
  {
    to: '/admin/videos',
    label: 'ভিডিও ম্যানেজমেন্ট',
    ic: 'video',
    roles: MODERATOR_ROLES
  },

  // Menu Management
  {
    to: '/admin/menu',
    label: 'মেনু ম্যানেজমেন্ট',
    ic: 'menu',
    roles: MODERATOR_ROLES
  },

  // Subscription Management
  {
    to: '/admin/subscriptions',
    label: 'সাবস্ক্রিপশন ম্যানেজমেন্ট',
    ic: 'credit-card',
    roles: MODERATOR_ROLES
  },

  // Core
  {
    to: '/admin/core',
    label: 'Core Management',
    ic: 'layers',
    roles: MODERATOR_ROLES
  },

  // Misc
  {
    to: '/admin/misc',
    label: 'Misc Management',
    ic: 'layout-grid',
    roles: MODERATOR_ROLES
  },

  // Content & Course Review
  {
    to: '/admin/content-review',
    label: 'কনটেন্ট রিভিউ',
    ic: 'file-check',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/lesson-review',
    label: 'লেসন রিভিউ',
    ic: 'book-open',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/notes-review',
    label: 'নোটস রিভিউ',
    ic: 'file-text',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/pdf-review',
    label: 'PDF রিভিউ',
    ic: 'file',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/slides-review',
    label: 'স্লাইড রিভিউ',
    ic: 'presentation',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/question-bank',
    label: 'প্রশ্ন ব্যাংক রিভিউ',
    ic: 'help-circle',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/exam-review',
    label: 'পরীক্ষার কনটেন্ট রিভিউ',
    ic: 'clipboard-check',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/content-reports',
    label: 'ভুল কনটেন্ট রিপোর্ট',
    ic: 'alert-triangle',
    roles: MODERATOR_ROLES
  },

  // Store Management
  {
    to: '/admin/store-books',
    label: 'স্টোর বই',
    ic: 'book',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/store-slides',
    label: 'স্টোর স্লাইড',
    ic: 'presentation',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/store-products',
    label: 'পণ্য ব্যবস্থাপনা',
    ic: 'package',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/product-details',
    label: 'পণ্যের বিস্তারিত',
    ic: 'file-text',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/stock',
    label: 'স্টক ম্যানেজমেন্ট',
    ic: 'boxes',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/order-status',
    label: 'অর্ডার স্ট্যাটাস',
    ic: 'truck',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/customer-support',
    label: 'কাস্টমার সাপোর্ট',
    ic: 'headphones',
    roles: MODERATOR_ROLES
  },

  // Demographics & Reports
  {
    to: '/admin/class-students',
    label: 'শ্রেণিভিত্তিক শিক্ষার্থী',
    ic: 'users',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/group-students',
    label: 'গ্রুপভিত্তিক শিক্ষার্থী',
    ic: 'users',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/registration-report',
    label: 'রেজিস্ট্রেশন রিপোর্ট',
    ic: 'file-chart',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/course-enrollment-report',
    label: 'কোর্স এনরোলমেন্ট রিপোর্ট',
    ic: 'chart',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/user-activity-report',
    label: 'ইউজার অ্যাক্টিভিটি রিপোর্ট',
    ic: 'activity',
    roles: MODERATOR_ROLES
  },

  // Marketing Management
  {
    to: '/admin/promo-codes',
    label: 'প্রোমো কোড',
    ic: 'ticket',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/campaigns',
    label: 'ক্যাম্পেইন',
    ic: 'megaphone',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/banners',
    label: 'ব্যানার ম্যানেজমেন্ট',
    ic: 'image',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/referrals',
    label: 'রেফারেল ট্র্যাকিং',
    ic: 'share',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/notification-campaigns',
    label: 'নোটিফিকেশন ক্যাম্পেইন',
    ic: 'bell',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/marketing-review',
    label: 'মার্কেটিং কনটেন্ট রিভিউ',
    ic: 'check-circle',
    roles: MODERATOR_ROLES
  },

  // Moderation & Reports
  {
    to: '/admin/student-reports',
    label: 'শিক্ষার্থী রিপোর্ট',
    ic: 'user-x',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/comment-reports',
    label: 'কমেন্ট রিপোর্ট',
    ic: 'message-square',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/spam',
    label: 'স্প্যাম রিপোর্ট',
    ic: 'shield-alert',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/inappropriate-content',
    label: 'অনুপযুক্ত কনটেন্ট',
    ic: 'alert-circle',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/warnings',
    label: 'সতর্কবার্তা',
    ic: 'alert-triangle',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/content-hide',
    label: 'কনটেন্ট Hide',
    ic: 'eye-off',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/admin-escalation',
    label: 'অ্যাডমিন এসকেলেশন',
    ic: 'arrow-up-circle',
    roles: MODERATOR_ROLES
  },

  // Support & Helpdesk
  {
    to: '/admin/tickets',
    label: 'সাপোর্ট টিকিট',
    ic: 'headphones',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/ticket-assign',
    label: 'টিকিট অ্যাসাইন',
    ic: 'user-check',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/ticket-replies',
    label: 'টিকিট রিপ্লাই',
    ic: 'reply',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/ticket-priority',
    label: 'টিকিট প্রায়োরিটি',
    ic: 'flag',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/ticket-status',
    label: 'Pending / Resolved',
    ic: 'check-square',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/complaint-history',
    label: 'অভিযোগের ইতিহাস',
    ic: 'history',
    roles: MODERATOR_ROLES
  },

  // Miscellaneous
  {
    to: '/admin/faq',
    label: 'FAQ',
    ic: 'help-circle',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/feedback',
    label: 'ফিডব্যাক',
    ic: 'message-circle',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/app-notices',
    label: 'অ্যাপ নোটিশ',
    ic: 'bell',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/help-articles',
    label: 'হেল্প আর্টিকেল',
    ic: 'book-open',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/error-reports',
    label: 'এরর রিপোর্ট',
    ic: 'bug',
    roles: MODERATOR_ROLES
  },
  {
    to: '/admin/general-settings',
    label: 'অনুমোদিত সাধারণ সেটিংস',
    ic: 'settings',
    roles: MODERATOR_ROLES
  },

  // Activity Log
  {
    to: '/admin/activity-log',
    label: 'অ্যাক্টিভিটি লগ',
    ic: 'history',
    roles: MODERATOR_ROLES
  },

  // Super Admin only
  {
    to: '/admin/welcome',
    label: 'ওয়েলকাম পেজ',
    ic: 'globe',
    roles: ['super_admin']
  },
  {
    to: '/admin/settings',
    label: 'সাইট সেটিংস',
    ic: 'settings',
    roles: ['super_admin']
  }
];

export const canAdmin = (path) => {
  const item = ADMIN_NAV.find((n) => n.to === path);
  return !!item && item.roles.includes(role());
};

const FOOT = html`
  <footer class="site-foot">
    © ২০২৬ Classical Academy. All rights reserved.
  </footer>
`;

function buildShell(layout) {
  const a = app();

  if (layout === 'student') {
    put(
      a,
      html`
        <div class="shell student">
          <header class="topbar">
            <a href="#/home" class="brand">
              ${logoMark()}
              <span>ক্লাসিক্যাল একাডেমি</span>
            </a>

            <div class="top-actions">
              ${
                isStaff()
                  ? html`
                      <a class="chip-link" href="#/admin">
                        ${icon('settings', 18)}
                        <span>প্যানেল</span>
                      </a>
                    `
                  : ''
              }

              <a class="icon-btn" href="#/cart" aria-label="কার্ট">
                ${icon('cart', 20)}
              </a>
            </div>
          </header>

          <main class="view" data-view></main>

          ${FOOT}

          <nav class="bottom-nav" aria-label="প্রধান নেভিগেশন">
            ${STUDENT_NAV.map(
              (n) => html`
                <a href="#${n.to}" data-nav="${n.to}">
                  ${icon(n.ic, 24)}
                  <span>${n.label}</span>
                </a>
              `
            )}
          </nav>
        </div>
      `
    );
  } else if (layout === 'admin') {
    const items = ADMIN_NAV.filter((n) =>
      n.roles.includes(role())
    );

    put(
      a,
      html`
        <div class="shell admin">
          <aside class="side" id="side">
            <a href="#/admin" class="brand">
              ${logoMark()}
              <span>Classical Academy</span>
            </a>

            <nav>
              ${items.map(
                (n) => html`
                  <a href="#${n.to}" data-nav="${n.to}">
                    ${icon(n.ic, 20)}
                    <span>${n.label}</span>
                  </a>
                `
              )}
            </nav>

            <div class="side-foot">
              <a href="#/home">
                ${icon('home', 18)}
                শিক্ষার্থী ভিউ
              </a>

              <button id="adm-out" class="linklike">
                ${icon('logout', 18)}
                লগআউট
              </button>
            </div>
          </aside>

          <div class="side-scrim" id="scrim"></div>

          <div class="admin-main">
            <header class="topbar">
              <button class="icon-btn" id="burger" aria-label="মেনু">
                ${icon('menu', 22)}
              </button>

              <strong>Classical Academy</strong>

              <span class="role-pill">${role()}</span>
            </header>

            <main class="view" data-view></main>

            ${FOOT}
          </div>
        </div>
      `
    );

    const side = $('#side');
    const scrim = $('#scrim');

    $('#burger').addEventListener('click', () => {
      side.classList.toggle('open');
      scrim.classList.toggle('open');
    });

    scrim.addEventListener('click', () => {
      side.classList.remove('open');
      scrim.classList.remove('open');
    });

    $$('#side nav a').forEach((link) => {
      link.addEventListener('click', () => {
        side.classList.remove('open');
        scrim.classList.remove('open');
      });
    });

    $('#adm-out').addEventListener('click', async () => {
  const button = $('#adm-out');

  if (button) {
    button.disabled = true;
    button.textContent = 'লগআউট হচ্ছে...';
  }

  try {
    await signOut();

    // Logout-এর পর Login পেজে যাও
    location.hash = '#/login';

    // পুরোনো পেজ পুনরায় render
    render();

  } catch (error) {
    console.error('Logout error:', error);

    alert(
      'লগআউট করা যায়নি। আবার চেষ্টা করুন।'
    );

    if (button) {
      button.disabled = false;
    }
  }
});
    });
  } else {
    put(
      a,
      html`
        <div class="shell public">
          <main class="view" data-view></main>
        </div>
      `
    );
  }
}

function updateNav(path) {
  $$('[data-nav]').forEach((link) => {
    const to = link.dataset.nav;
    const stu = STUDENT_NAV.find((n) => n.to === to);

    const active = stu
      ? stu.match.test(path)
      : to === '/admin'
        ? path === '/admin'
        : path.startsWith(to);

    link.classList.toggle('active', active);

    if (active) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

export async function render() {
  const a = app();

  if (!a) return;

  // Auth initialization শেষ না হওয়া পর্যন্ত redirect নয়
  if (!state.authReady) {
    put(
      a,
      html`
        <div class="center-screen">
          <div class="spin lg"></div>
          <p class="muted">অ্যাকাউন্ট যাচাই করা হচ্ছে...</p>
        </div>
      `
    );

    return;
  }

  const rawPath = location.hash.slice(1) || '/';
  const [path, qs] = rawPath.split('?');

  const query = Object.fromEntries(
    new URLSearchParams(qs || '')
  );

  let found = null;
  let params = {};

  for (const rt of routes) {
    const m = path.match(rt.re);

    if (m) {
      found = rt;

      rt.keys.forEach((k, i) => {
        params[k] = decodeURIComponent(m[i + 1]);
      });

      break;
    }
  }

  if (!found) {
    found = {
      handler: notFound,
      opts: { layout: 'public' }
    };
  }

  const o = found.opts;

  // Login guard
  if (o.auth && !state.session) {
    return navigate(
      '/login?next=' + encodeURIComponent(rawPath)
    );
  }

  // Session আছে, কিন্তু profile এখনো লোড হয়নি
  if (o.auth && state.session && !state.profile) {
    put(
      a,
      html`
        <div class="center-screen">
          <div class="spin lg"></div>
          <p class="muted">প্রোফাইল লোড হচ্ছে...</p>
        </div>
      `
    );

    shellKey = '';

    const { loadProfile } = await import('./db.js');

    await loadProfile();

    if (!state.profile) {
      put(
        a,
        html`
          <div class="center-screen">
            <p>প্রোফাইল লোড করা যায়নি।</p>

            <button
              class="btn primary"
              onclick="location.reload()"
            >
              রিলোড
            </button>
          </div>
        `
      );

      return;
    }
  }

  // Student profile completion
  if (
    o.auth &&
    state.profile?.role === 'student' &&
    !state.profile.class_level &&
    path !== '/complete-profile'
  ) {
    return navigate('/complete-profile');
  }

  // Role permission check
  if (o.roles && !o.roles.includes(role())) {
    toastDenied();
    return navigate('/home');
  }

  // Logged-in user guest page এ থাকলে redirect
  if (o.guestOnly && state.session) {
    return navigate(
      isStaff() && o.adminHome ? '/admin' : '/home'
    );
  }

  const t = ++token;

  const key =
    o.layout + ':' +
    (o.layout === 'admin' ? role() : isStaff());

  if (key !== shellKey) {
    buildShell(o.layout);
    shellKey = key;
  }

  updateNav(path);

  const view = $('[data-view]');

  put(view, skeleton());

  view.classList.remove('page-in');

  try {
    await found.handler({
      root: view,
      params,
      query,
      path,
      stale: () => t !== token
    });
  } catch (e) {
    console.error(e);

    if (t === token) {
      put(
        view,
        html`
          <div class="card pad center">
            <h3>দুঃখিত, লোড করা যায়নি</h3>

            <p class="muted">${errMsg(e)}</p>

            <button class="btn primary" id="retry">
              আবার চেষ্টা করুন
            </button>
          </div>
        `
      );

      $('#retry')?.addEventListener('click', render);
    }
  }

  if (t === token) {
    void view.offsetWidth;
    view.classList.add('page-in');

    if (!query.keep) {
      window.scrollTo(0, 0);
    }
  }
}

function toastDenied() {
  import('./lib.js').then((m) =>
    m.toast('এই পেজে প্রবেশের অনুমতি নেই।', 'err')
  );
}

async function notFound({ root }) {
  put(
    root,
    html`
      <div class="center-screen">
        <h2>৪০৪</h2>

        <p class="muted">
          পেজটি খুঁজে পাওয়া যায়নি।
        </p>

        <a class="btn primary" href="#/">
          হোমে ফিরুন
        </a>
      </div>
    `
  );
}

export function resetShell() {
  shellKey = '';
}

// Router startup
export function startRouter() {
  if (routerStarted) return;

  routerStarted = true;

  // Auth state পরিবর্তন হলে Router পুনরায় render
  onAuth((event) => {
    if (
      event === 'auth_ready' ||
      event === 'signed_in' ||
      event === 'signed_out'
    ) {
      render();
    }
  });

  // URL route পরিবর্তন
  window.addEventListener('hashchange', render);

  // প্রথম render
  render();
                           }
