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
  listeners.forEach((fn) => fn(evt));
};

// ---------- Supabase initialization ----------

export async function initBackend() {
  if (!configured) {
    state.authReady = true;
    emit('auth_ready');
    return false;
  }

  const { createClient } = await import(SDK);

  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      flowType: 'pkce',
      storage: window.sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  // Subscribe before reading the session.
  sb.auth.onAuthStateChange((evt, session) => {
    state.session = session;

    // Do not await Supabase calls directly inside this callback.
    setTimeout(async () => {
      if (evt === 'PASSWORD_RECOVERY') {
        location.hash = '#/reset-password';
        return;
      }

      if (evt === 'SIGNED_OUT') {
        state.profile = null;
        emit('signed_out');
        return;
      }

      if (
        evt === 'SIGNED_IN' &&
        session &&
        state.profile?.id !== session.user.id
      ) {
        await loadProfile();
        registerDevice();
        emit('signed_in');
      }
    }, 0);
  });

  const { data, error } = await sb.auth.getSession();

  if (error) {
    console.error('Session load error:', error);
  }

  state.session = data?.session || null;

  if (state.session) {
    await loadProfile();
  }

  // Remove the PKCE code from the URL.
  if (location.search) {
    history.replaceState(
      null,
      '',
      location.pathname + location.hash
    );
  }

  if (state.profile) {
    registerDevice();
  }

  state.authReady = true;
  emit('auth_ready');

  return true;
}

// ---------- Profile ----------

export async function loadProfile() {
  if (!state.session || !sb) {
    state.profile = null;
    return null;
  }

  for (let i = 0; i < 3; i++) {
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', state.session.user.id)
      .maybeSingle();

    if (data) {
      state.profile = data;
      return data;
    }

    if (error) {
      console.error('Profile load error:', error);
    }

    // Signup trigger may need a moment.
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

// ---------- Sign out ----------

export async function signOut() {
  if (!sb) return;

  const { error } = await sb.auth.signOut();

  if (error) throw error;

  state.session = null;
  state.profile = null;
}

// ---------- Device + activity ----------

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

  await sb.from('devices').upsert(
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

// ---------- Settings ----------

export async function getSetting(key) {
  if (!sb) return {};

  const { data } = await sb
    .from('site_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  return data?.value || {};
}

// ---------- Storage ----------

const safeName = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'file';

/**
 * Upload a file.
 * Public buckets return a public URL.
 * Private bucket returns the object path.
 */
export async function uploadFile(bucket, file, folder = '') {
  if (!sb) throw new Error('Supabase is not initialized');

  const path =
    `${folder ? folder + '/' : ''}` +
    `${Date.now()}-${safeName(file.name)}`;

  const { error } = await sb.storage
    .from(bucket)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || undefined
    });

  if (error) throw error;

  if (bucket === 'private-files') {
    return path;
  }

  return sb.storage
    .from(bucket)
    .getPublicUrl(path)
    .data.publicUrl;
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

// ---------- Bookmarks ----------

export async function getBookmarkSet() {
  if (!sb || !uid()) return new Set();

  const { data, error } = await sb
    .from('bookmarks')
    .select('item_type,item_id')
    .eq('user_id', uid());

  if (error) throw error;

  return new Set(
    (data || []).map(
      (bookmark) =>
        `${bookmark.item_type}:${bookmark.item_id}`
    )
  );
}

export async function toggleBookmark(type, id, on) {
  if (!sb || !uid()) {
    throw new Error('Please login first');
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
