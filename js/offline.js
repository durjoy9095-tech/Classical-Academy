// Offline content: PDFs are stored in the browser's Cache Storage (per device).
import { signedUrl, uid } from './db.js';
const CACHE = 'ca-offline-v1';
const key = () => `ca_offline_${uid()}`;
export const offlineSupported = () => 'caches' in window;
export const listOffline = () => { try { return JSON.parse(localStorage.getItem(key()) || '[]'); } catch { return []; } };
const saveList = (l) => localStorage.setItem(key(), JSON.stringify(l));
export const isOffline = (id) => listOffline().some((x) => x.id === id);

export async function saveOffline({ id, title, path }) {
  if (!offlineSupported()) throw new Error('এই ব্রাউজারে অফলাইন সংরক্ষণ সমর্থিত নয়।');
  const res = await fetch(await signedUrl(path, 300));
  if (!res.ok) throw new Error('ফাইল ডাউনলোড করা যায়নি।');
  const c = await caches.open(CACHE);
  await c.put(`/offline/${uid()}/${id}`, res);
  const list = listOffline().filter((x) => x.id !== id);
  list.unshift({ id, title, saved_at: new Date().toISOString() });
  saveList(list);
}
export async function removeOffline(id) {
  const c = await caches.open(CACHE); await c.delete(`/offline/${uid()}/${id}`);
  saveList(listOffline().filter((x) => x.id !== id));
}
export async function openOffline(id) {
  const c = await caches.open(CACHE);
  const res = await c.match(`/offline/${uid()}/${id}`);
  if (!res) throw new Error('অফলাইন ফাইল পাওয়া যায়নি।');
  const blob = await res.blob();
  window.open(URL.createObjectURL(blob), '_blank');
}
export async function clearOfflineFor(userId) {   // used on logout of shared devices
  localStorage.removeItem(`ca_offline_${userId}`);
}
