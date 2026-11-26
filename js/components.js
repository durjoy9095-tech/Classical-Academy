// Reusable view fragments.
import { html, icon, money, classLabel, groupLabel, safeUrl, PRODUCT_KINDS } from './lib.js';

export const initials = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const avatar = (url, name, cls = '') => url && safeUrl(url)
  ? html`<div class="avatar ${cls}"><img src="${safeUrl(url)}" alt="${name || ''}" loading="lazy"></div>`
  : html`<div class="avatar ${cls}">${initials(name)}</div>`;

export const thumb = (url, ic = 'courses', cls = '') => html`<div class="thumb ${cls}">
  ${safeUrl(url) ? html`<img src="${safeUrl(url)}" alt="" loading="lazy">` : icon(ic, 44)}</div>`;

export function courseCard(c, { progress = null, enrolled = false } = {}) {
  return html`<a class="card hover" href="#/course/${c.id}">
    <div class="thumb">${safeUrl(c.thumbnail_url) ? html`<img src="${safeUrl(c.thumbnail_url)}" alt="" loading="lazy">` : icon('courses', 44)}
      <span class="badge ${c.price > 0 ? '' : 'free'}">${c.price > 0 ? 'প্রিমিয়াম' : 'ফ্রি'}</span></div>
    <div class="item-body">
      <h3>${c.title}</h3>
      <div class="meta"><span>${classLabel(c.class_level)}</span>${c.group_name ? html`<span>· ${groupLabel(c.group_name)}</span>` : ''}
        ${c.subject?.name ? html`<span>· ${c.subject.name}</span>` : ''}</div>
      ${c.teacher?.full_name ? html`<div class="meta mt">${icon('user', 16)} ${c.teacher.full_name}</div>` : ''}
      ${progress != null ? html`<div class="mt"><div class="progress"><i style="width:${progress}%"></i></div>
        <div class="meta small">অগ্রগতি: ${progress}%</div></div>`
        : html`<div class="row between mt"><span class="price">${money(c.price)}</span>
          ${enrolled ? html`<span class="badge ok">ভর্তি আছেন</span>` : ''}</div>`}
    </div></a>`;
}

export const productCard = (p, owned) => html`<a class="card hover" href="#/store/${p.id}">
  <div class="thumb sq">${safeUrl(p.image_url) ? html`<img src="${safeUrl(p.image_url)}" alt="" loading="lazy">` : icon('store', 44)}
    <span class="badge">${PRODUCT_KINDS[p.kind] || p.kind}</span></div>
  <div class="item-body"><h3>${p.title}</h3>
    <div class="row between"><span class="price">${money(p.price)}</span>${owned ? html`<span class="badge ok">কেনা হয়েছে</span>` : ''}</div></div></a>`;

export const teacherCard = (t) => html`<div class="card teacher-card hover">
  ${avatar(t.avatar_url, t.full_name, 'lg')}<h3>${t.full_name}</h3>
  ${t.subject ? html`<span class="badge">${t.subject}</span>` : ''}
  ${t.qualification ? html`<p class="small mt muted">${t.qualification}</p>` : ''}
  ${t.experience ? html`<p class="small muted">অভিজ্ঞতা: ${t.experience}</p>` : ''}
  ${t.bio ? html`<p class="small">${t.bio}</p>` : ''}</div>`;

export const statusBadge = (s, map) => {
  const cls = { paid: 'ok', verified: 'ok', graded: 'ok', answered: 'ok', pending: 'warn', open: 'warn', submitted: 'warn', cancelled: 'err', rejected: 'err', closed: '' }[s] || '';
  return html`<span class="badge ${cls}">${map?.[s] || s}</span>`;
};

export const backLink = (to, text = 'পেছনে') => html`<a class="btn ghost sm mb" href="#${to}">${icon('back', 16)} ${text}</a>`;
