import {
  html,
  put,
  icon
} from './lib.js';

import {
  sb,
  uid
} from './db.js';

export async function studentInbox({ root }) {
  const userId = uid();

  if (!sb || !userId) {
    put(
      root,
      html`
        <div class="card pad center">
          <h3>লগইন প্রয়োজন</h3>
          <p>মেসেজ দেখতে আগে লগইন করুন।</p>
        </div>
      `
    );
    return;
  }

  put(
    root,
    html`
      <section class="page-head">
        <h1>আমার মেসেজ</h1>
        <p class="muted">
          Classical Academy থেকে পাঠানো গুরুত্বপূর্ণ বার্তা
        </p>
      </section>

      <div class="card pad center">
        <div class="spin"></div>
        <p class="muted">মেসেজ লোড হচ্ছে...</p>
      </div>
    `
  );

  const { data, error } = await sb
    .from('inbox_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', {
      ascending: false
    });

  if (error) {
    console.error('Inbox error:', error);

    put(
      root,
      html`
        <div class="card pad center">
          <h3>মেসেজ লোড করা যায়নি</h3>
          <p class="muted">
            ${error.message}
          </p>

          <button
            class="btn primary"
            id="inbox-retry"
          >
            আবার চেষ্টা করুন
          </button>
        </div>
      `
    );

    root.querySelector('#inbox-retry')
      ?.addEventListener('click', () => {
        studentInbox({ root });
      });

    return;
  }

  const messages = data || [];

  if (messages.length === 0) {
    put(
      root,
      html`
        <div class="card pad center">
          ${icon('mail', 42)}

          <h3>এখনো কোনো মেসেজ নেই</h3>

          <p class="muted">
            Admin কোনো মেসেজ পাঠালে এখানে দেখতে পাবেন।
          </p>
        </div>
      `
    );

    return;
  }

  const unreadIds = messages
    .filter((m) => !m.is_read)
    .map((m) => m.id);

  if (unreadIds.length > 0) {
    const { error: readError } = await sb
      .from('inbox_messages')
      .update({ is_read: true })
      .eq('user_id', userId)
      .in('id', unreadIds);

    if (readError) {
      console.error('Read status error:', readError);
    }
  }

  put(
    root,
    html`
      <section class="page-head">
        <h1>আমার মেসেজ</h1>

        <p class="muted">
          মোট ${messages.length}টি মেসেজ
        </p>
      </section>

      <div class="inbox-list">
        ${messages.map(
          (m) => html`
            <article class="card pad inbox-message">
              <div class="row between">
                <h3>${m.subject || 'নতুন মেসেজ'}</h3>

                ${
                  !m.is_read
                    ? html`
                        <span class="badge">
                          নতুন
                        </span>
                      `
                    : ''
                }
              </div>

              <p class="inbox-body">
                ${m.message || ''}
              </p>

              <div class="muted inbox-date">
                ${new Date(
                  m.created_at
                ).toLocaleString('bn-BD')}
              </div>
            </article>
          `
        )}
      </div>
    `
  );
                  }
