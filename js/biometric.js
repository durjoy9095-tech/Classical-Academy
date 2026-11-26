// Biometric app-lock using WebAuthn (device fingerprint / face / PIN). It locks the app UI on
// this device; the Supabase session itself is still protected by normal authentication.
import { state, uid } from './db.js';

const KEY = 'ca_bio';
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };

export async function bioSupported() {
  try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
  catch { return false; }
}
export const bioEnabled = () => { const x = read(); return !!x && x.uid === uid(); };
export const bioEnabledFor = (userId) => { const x = read(); return !!x && x.uid === userId; };

export async function bioEnable() {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: rand(32), rp: { name: 'Classical Academy' },
    user: { id: new TextEncoder().encode(uid()), name: state.profile.email || state.profile.username || 'student', displayName: state.profile.full_name || 'Student' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
    timeout: 60000 } });
  localStorage.setItem(KEY, JSON.stringify({ uid: uid(), id: b64(cred.rawId) }));
  sessionStorage.setItem('ca_unlocked', uid());
}
export function bioDisable() { localStorage.removeItem(KEY); sessionStorage.removeItem('ca_unlocked'); }
export async function bioVerify() {
  const x = read(); if (!x) return true;
  await navigator.credentials.get({ publicKey: { challenge: rand(32), allowCredentials: [{ type: 'public-key', id: unb64(x.id) }], userVerification: 'required', timeout: 60000 } });
  sessionStorage.setItem('ca_unlocked', x.uid); return true;
}
export const isUnlocked = (userId) => sessionStorage.getItem('ca_unlocked') === userId;
