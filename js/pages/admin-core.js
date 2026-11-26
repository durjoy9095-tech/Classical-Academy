// Generic admin CRUD engine (table + search + modal form + uploads).
import { safeUrl, html, put, icon, $, $$, errMsg, toast, must, openModal, confirmBox, debounce, btnBusy, toLocalInput, fromLocalInput, empty, raw } from '../lib.js';
import { sb, uploadFile } from '../db.js';

const fieldHtml = (f, val, options) => {
  const id = 'f_' + f.name, v = f.toForm ? f.toForm(val) : val, req = f.required ? 'required' : '';
  const label = html`<label for="${id}">${f.label}${f.required ? ' *' : ''}</label>`;
  const hint = f.hint ? html`<div class="hint">${f.hint}</div>` : '';
  switch (f.type) {
    case 'textarea': return html`<div class="field" style="grid-column:1/-1">${label}<textarea id="${id}" name="${f.name}" rows="4" ${req}>${v ?? ''}</textarea>${hint}</div>`;
    case 'lines': return html`<div class="field" style="grid-column:1/-1">${label}<textarea id="${id}" name="${f.name}" rows="5">${Array.isArray(v) ? v.join('\n') : ''}</textarea>${hint}</div>`;
    case 'number': return html`<div class="field">${label}<input id="${id}" name="${f.name}" type="number" step="${f.step || 'any'}" ${f.min != null ? html`min="${f.min}"` : ''} value="${v ?? f.default ?? ''}" ${req}>${hint}</div>`;
    case 'select': return html`<div class="field">${label}<select id="${id}" name="${f.name}" ${req}><option value="">${f.placeholder || '— নির্বাচন করুন —'}</option>
      ${options.map((o) => html`<option value="${o.v}" ${String(v ?? f.default ?? '') === String(o.v) ? 'selected' : ''}>${o.l}</option>`)}</select>${hint}</div>`;
    case 'checkbox': return html`<div class="field"><label class="check"><input type="checkbox" name="${f.name}" ${(v ?? f.default) ? 'checked' : ''}> ${f.label}</label>${hint}</div>`;
    case 'datetime': return html`<div class="field">${label}<input id="${id}" name="${f.name}" type="datetime-local" value="${toLocalInput(v)}" ${req}>${hint}</div>`;
    case 'image': return html`<div class="field">${label}<input id="${id}" name="${f.name}" type="file" accept="image/*">${v ? html`<div class="hint">বর্তমান ছবি আছে — নতুন বাছলে বদলে যাবে।</div>` : hint}</div>`;
    case 'file': return html`<div class="field">${label}<input id="${id}" name="${f.name}" type="file" accept="${f.accept || '.pdf,.doc,.docx,.ppt,.pptx,.zip,image/*'}">${v ? html`<div class="hint">বর্তমান ফাইল আছে — নতুন বাছলে বদলে যাবে।</div>` : hint}</div>`;
    default: return html`<div class="field">${label}<input id="${id}" name="${f.name}" type="${f.type === 'url' ? 'url' : 'text'}" value="${v ?? ''}" ${req} ${f.maxlength ? html`maxlength="${f.maxlength}"` : ''}>${hint}</div>`;
  }
};

async function collect(form, fields, row) {
  const out = {}, fd = new FormData(form);
  for (const f of fields) {
    if (f.hidden) continue;
    let v;
    if (f.type === 'checkbox') v = form.elements[f.name].checked;
    else if (f.type === 'number') { const s = fd.get(f.name); v = s === '' || s == null ? null : Number(s); }
    else if (f.type === 'datetime') v = fromLocalInput(fd.get(f.name));
    else if (f.type === 'lines') v = String(fd.get(f.name) || '').split('\n').map((s) => s.trim()).filter(Boolean);
    else if (f.type === 'image' || f.type === 'file') {
      const file = form.elements[f.name].files[0];
      if (!file && f.required && !row?.[f.name]) throw new Error(`${f.label} আবশ্যক।`);
      v = undefined; if (file) { out.__uploads ||= []; out.__uploads.push([f, file]); }
    } else { v = String(fd.get(f.name) ?? '').trim(); if (f.type === 'select' && f.int && v) v = Number(v); if (v === '') v = null; }
    if (v !== undefined) {
      if (f.fromForm) v = f.fromForm(v);
      if (f.required && (v == null || v === '' || (Array.isArray(v) && !v.length))) throw new Error(`${f.label} আবশ্যক।`);
      out[f.name] = v;
    }
  }
  return out;
}

/** Open the add/edit modal. cfg: {title, table, fields, defaults, beforeSave, validate} */
export async function openForm(cfg, row, done) {
  const opts = {};
  await Promise.all(cfg.fields.filter((f) => f.type === 'select').map(async (f) => { opts[f.name] = f.options || (f.load ? await f.load() : []); }));
  const fields = cfg.fields.filter((f) => !f.hidden);
  openModal(html`<h3>${row ? 'সম্পাদনা' : 'নতুন যোগ করুন'} — ${cfg.title}</h3>
    <form id="mf" novalidate><div class="form-grid">${fields.map((f) => fieldHtml(f, row ? row[f.name] : undefined, opts[f.name]))}</div>
    <div class="row end gap mt"><button type="button" class="btn ghost" data-close>বাতিল</button><button class="btn primary" type="submit">সংরক্ষণ করুন</button></div></form>`, {
    wide: cfg.wide,
    onMount: (m, close) => {
      const form = $('#mf', m);
      form.addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = $('button[type=submit]', form); btnBusy(btn, true, ' সংরক্ষণ হচ্ছে…');
        try {
          const data = await collect(form, cfg.fields, row);
          const uploads = data.__uploads || []; delete data.__uploads;
          for (const [f, file] of uploads) data[f.name] = await uploadFile(f.type === 'image' ? (f.bucket || 'public-media') : 'private-files', file, f.folder || '');
          const payload = { ...(row ? {} : (cfg.defaults?.() || {})), ...data };
          cfg.validate?.(payload, row);
          const body = cfg.beforeSave ? await cfg.beforeSave(payload, row) : payload;
          if (row) must(await sb.from(cfg.table).update(body).eq(cfg.pk || 'id', row[cfg.pk || 'id']));
          else must(await sb.from(cfg.table).insert(body));
          toast('সংরক্ষিত হয়েছে।'); close(); done();
        } catch (err) { btnBusy(btn, false); toast(errMsg(err), 'err'); }
      });
    },
  });
}

/** Build a page handler for a table. */
export function crudPage(cfg) {
  return async ({ root }) => {
    const pk = cfg.pk || 'id';
    let rows = [];
    const load = async () => {
      let q = sb.from(cfg.table).select(cfg.select || '*');
      Object.entries(cfg.filter || {}).forEach(([k, v]) => { q = q.eq(k, v); });
      if (cfg.modify) q = cfg.modify(q);
      if (cfg.order !== false) q = q.order(cfg.order?.col || 'created_at', { ascending: cfg.order?.asc ?? false });
      rows = must(await q.limit(500));
    };
    await load();
    put(root, html`${cfg.back ? html`<a class="btn ghost sm mb" href="#${cfg.back}">${icon('back', 16)} পেছনে</a>` : ''}
      <div class="toolbar"><h2>${cfg.title}</h2><div class="search">${icon('search', 18)}<input id="q" placeholder="খুঁজুন…"></div>
        ${cfg.canCreate === false ? '' : html`<button class="btn primary" id="add">${icon('plus', 18)} যোগ করুন</button>`}</div>
      ${cfg.intro ? html`<p class="muted">${cfg.intro}</p>` : ''}<div id="tbl"></div>`);
    const draw = () => {
      const q = $('#q', root).value.trim().toLowerCase();
      const list = rows.filter((r) => !q || (cfg.search ? cfg.search(r) : JSON.stringify(r)).toLowerCase().includes(q));
      put($('#tbl', root), list.length ? html`<div class="table-wrap"><table><thead><tr>${cfg.columns.map((c) => html`<th>${c.label}</th>`)}<th>কাজ</th></tr></thead><tbody>
        ${list.map((r) => html`<tr>${cfg.columns.map((c) => html`<td>${c.render(r)}</td>`)}<td style="white-space:nowrap">${cfg.extra ? cfg.extra(r) : ''}
          ${cfg.canEdit?.(r) === false ? '' : html`<button class="btn soft sm" data-edit="${r[pk]}">${icon('edit', 15)}</button>`}
          ${cfg.canDelete === false || cfg.canDelete?.(r) === false ? '' : html`<button class="btn danger sm" data-del="${r[pk]}">${icon('trash', 15)}</button>`}</td></tr>`)}</tbody></table></div>`
        : html`<div class="card">${empty('কোনো তথ্য পাওয়া যায়নি।', 'file')}</div>`);
      $$('[data-edit]', root).forEach((b) => b.addEventListener('click', () => openForm(cfg, rows.find((r) => String(r[pk]) === b.dataset.edit), reload)));
      $$('[data-del]', root).forEach((b) => b.addEventListener('click', async () => {
        if (!(await confirmBox('এটি স্থায়ীভাবে মুছে ফেলতে চান?'))) return;
        const { error } = await sb.from(cfg.table).delete().eq(pk, b.dataset.del);
        if (error) return toast(errMsg(error), 'err'); toast('মুছে ফেলা হয়েছে।'); reload();
      }));
      cfg.afterDraw?.(root, rows, reload);
    };
    const reload = async () => { try { await load(); draw(); } catch (e) { toast(errMsg(e), 'err'); } };
    $('#q', root).addEventListener('input', debounce(draw, 150));
    $('#add', root)?.addEventListener('click', () => openForm(cfg, null, reload));
    draw();
  };
}

export const yesNo = (b) => html`<span class="badge ${b ? 'ok' : ''}">${b ? 'হ্যাঁ' : 'না'}</span>`;
export const pub = (b) => html`<span class="badge ${b ? 'ok' : 'warn'}">${b ? 'প্রকাশিত' : 'খসড়া'}</span>`;
export const imgCell = (u) => safeUrl(u) ? html`<img class="mini-thumb" src="${safeUrl(u)}" alt="" loading="lazy">` : html`<span class="mini-thumb" style="display:inline-block"></span>`;
