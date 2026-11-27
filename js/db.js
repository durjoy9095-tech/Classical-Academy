// Supabase client, auth/session state and small data helpers.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { deviceLabel } from './lib.js';

const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export const configured =
  /^https:\/\/\S+$/.test(SUPABASE_URL) &&
  !SUPABASE_URL.includes('YOUR_') &&
  SUPABASE_ANON_KEY.length > 40 &&
  !SUPABASE_ANON_KEY.includes('YOUR_');

export let sb = null;

export const state = {
  session: null,
  profile: null,
  authReady: false
};

const listeners = new Set();

export const onAuth = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const emit = (evt) => {
  listeners.forEach((fn) => {
    try {
      fn(evt);
    } catch (error) {
      console.error('Auth listener error:', error);
    }
  });
};

export async function initBackend() {
  if (!configured) {
    state.authReady = true;
    return false;
  }

  if (sb) return true;

  const { createClient } = await import(SDK);

  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      flowType: 'pkce',

      // আলাদা Tab-এ আলাদা Login Session
      storage: window.sessionStorage,

      // Refresh-এর পর Session বজায় থাকবে
      persistSession: true,

      // Token স্বয়ংক্রিয়ভাবে Refresh হবে
      autoRefreshToken: true,

      // Login/Recovery Redirect Session শনাক্ত করবে
      detectSessionInUrl: true
    }
  });

  // Auth listener আগে চালু করা হচ্ছে
  sb.auth.onAuthStateChange((evt, session) => {
    state.session = session;

    // Supabase Auth callback-এর ভিতরে সরাসরি await করা যাবে না
    Promise.resolve().then(async () => {
      if (evt === 'PASSWORD_RECOVERY') {
        location.hash = '#/reset-password';
        emit('password_recovery');
        return;
      }

      if (evt === 'SIGNED_OUT') {
        state.session = null;
        state.profile = null;

        emit('signed_out');
        return;
      }

      if (
        (evt === 'SIGNED_IN' || evt === 'TOKEN_REFRESHED') &&
        session
      ) {
        state.session = session;

        if (state.profile?.id !== session.user.id) {
          await loadProfile();
        }

        if (state.profile) {
          registerDevice();
        }

        emit('signed_in');
      }

      if (evt === 'USER_UPDATED' && session) {
        state.session = session;
        emit('user_updated');
      }
    }).catch((error) => {
      console.error('Auth event error:', error);
    });
  });

  // আগের Session পড়া
  const { data, error } = await sb.auth.getSession();

  if (error) {
    console.error('Session restore error:', error);
  }

  state.session = data?.session || null;

  if (state.session) {
    await loadProfile();
  } else {
    state.profile = null;
  }

  // PKCE callback-এর ?code= URL পরিষ্কার করা
  if (location.search.includes('code=')) {
    history.replaceState(
      null,
      '',
      location.pathname + location.hash
    );
  }

  if (state.profile) {
    registerDevice();
  }

  // Auth initialization সম্পূর্ণ
  state.authReady = true;

  emit('auth_ready');

  return true;
}

export async function loadProfile() {
  if (!state.session?.user?.id || !sb) {
    state.profile = null;
    return null;
  }

  const userId = state.session.user.id;

  for (let i = 0; i < 3; i++) {
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Profile loading error:', error);
    }

    if (data) {
      state.profile = data;
      return data;
    }

    // Signup trigger তৈরি হতে সামান্য সময় লাগতে পারে
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  state.profile = null;
  return null;
}

export const uid = () => state.session?.user?.id;

export const role = () => state.profile?.role || null;

export const isStaff = () =>
  ['super_admin', 'admin', 'moderator', 'teacher'].includes(role());

export const isAdminUp = () =>
  ['super_admin', 'admin'].includes(role());

export async function signOut() {
  if (!sb) return;

  const { error } = await sb.auth.signOut();

  if (error) throw error;

  state.session = null;
  state.profile = null;

  emit('signed_out');
}

// ---------- device + activity ----------

export function deviceId() {
  let id = localStorage.getItem('ca_device_id');

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('ca_device_id', id);
  }

  return id;
}

export async function registerDevice() {
  if (!uid() || !sb) return;

  const { error } = await sb
    .from('devices')
    .upsert(
      {
        user_id: uid(),
        device_id: deviceId(),
        label: deviceLabel(),
        last_seen: new Date().toISOString()
      },
      {
        onConflict: 'user_id,device_id'
      }
    );

  if (error) {
    console.warn('Device registration failed:', error.message);
  }
}

export function logActivity(action, meta = {}) {
  if (!uid() || !sb) return;

  sb.from('activity_log')
    .insert({
      user_id: uid(),
      action,
      meta
    })
    .then(() => {}, () => {});
}

// ---------- settings ----------

export async function getSetting(key) {
  if (!sb) return {};

  const { data } = await sb
    .from('site_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  return data?.value || {};
}

// ---------- storage ----------

const safeName = (name) =>
  name.toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'file';

/**
 * Upload a File.
 * Public buckets return a public URL.
 * Private bucket returns the object path.
 */
export async function uploadFile(bucket, file, folder = '') {
  if (!sb) throw new Error('Supabase is not initialized');

  const path =
    `${folder ? folder + '/' : ''}${Date.now()}-${safeName(file.name)}`;

  const { error } = await sb.storage
    .from(bucket)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || undefined
    });

  if (error) throw error;

  return bucket === 'private-files'
    ? path
    : sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function signedUrl(path, secs = 3600, download) {
  if (!sb) throw new Error('Supabase is not initialized');

  const { data, error } = await sb.storage
    .from('private-files')
    .createSignedUrl(
      path,
      secs,
      download ? { download } : undefined
    );

  if (error) throw error;

  return data.signedUrl;
}

// ---------- bookmarks ----------

export async function getBookmarkSet() {
  if (!sb || !uid()) return new Set();

  const { data, error } = await sb
    .from('bookmarks')
    .select('item_type,item_id')
    .eq('user_id', uid());

  if (error) throw error;

  return new Set(
    (data || []).map(
      (bookmark) => `${bookmark.item_type}:${bookmark.item_id}`
    )
  );
}

export async function toggleBookmark(type, id, on) {
  if (!sb || !uid()) {
    throw new Error('লগইন করা নেই');
  }

  if (on) {
    const { error } = await sb
      .from('bookmarks')
      .upsert({
        user_id: uid(),
        item_type: type,
        item_id: id
      });

    if (error) throw error;
  } else {
    const { error } = await sb
      .from('bookmarks')
      .delete()
      .eq('user_id', uid())
      .eq('item_type', type)
      .eq('item_id', id);

    if (error) throw error;
  }
            }
