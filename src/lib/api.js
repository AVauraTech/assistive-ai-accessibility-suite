// Shared backend config + helpers for v2.0 modules.
export const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

let configCache = null;

// Which optional cloud/depth features the backend currently supports.
export async function fetchConfig() {
  if (configCache) return configCache;
  try {
    const res = await fetch(`${BACKEND}/api/config`);
    configCache = await res.json();
  } catch {
    configCache = { vlm: false, simplify: false, depth: false, model: null, offline: true };
  }
  return configCache;
}

export async function postJSON(path, body) {
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

// --- Haptics (roadmap: vibration feedback on stroke/letter events) ---------
export function buzz(pattern = 15) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* not supported / not permitted */
    }
  }
}

// --- Speech synthesis helper ----------------------------------------------
export function speak(text, { rate = 1, onend } = {}) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  if (onend) u.onend = onend;
  window.speechSynthesis.speak(u);
}
