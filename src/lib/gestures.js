// Landmark math shared across v2.0 client-side modules: gesture recognition,
// smoothing, ASL fingerspelling (heuristic), and gaze / head-pose estimation.

// MediaPipe Hands indices
const WRIST = 0;
const TIPS = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
const PIPS = { thumb: 2, index: 6, middle: 10, ring: 14, pinky: 18 };

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// --- Smoothing -------------------------------------------------------------
// Exponential moving average filter to kill camera jitter (roadmap 45% target).
export class Smoother {
  constructor(alpha = 0.5) {
    this.alpha = alpha;
    this.x = null;
    this.y = null;
  }
  update(x, y) {
    if (this.x === null) {
      this.x = x;
      this.y = y;
    } else {
      this.x = this.alpha * x + (1 - this.alpha) * this.x;
      this.y = this.alpha * y + (1 - this.alpha) * this.y;
    }
    return { x: this.x, y: this.y };
  }
  reset() {
    this.x = null;
    this.y = null;
  }
}

// --- Finger states ---------------------------------------------------------
// Returns which fingers are extended. Thumb uses distance-from-wrist; the other
// four compare tip vs pip distance from the wrist (robust to orientation).
export function fingerStates(lm) {
  const wrist = lm[WRIST];
  const out = {};
  for (const name of ['index', 'middle', 'ring', 'pinky']) {
    out[name] = dist(lm[TIPS[name]], wrist) > dist(lm[PIPS[name]], wrist) * 1.15;
  }
  // Thumb: extended if tip is well away from the index MCP joint.
  out.thumb = dist(lm[TIPS.thumb], wrist) > dist(lm[PIPS.thumb], wrist) * 1.05;
  return out;
}

function pinch(lm) {
  return dist(lm[TIPS.thumb], lm[TIPS.index]) < 0.06;
}

// --- Air-writing gestures --------------------------------------------------
export function classifyGesture(lm) {
  const f = fingerStates(lm);
  const up = [f.index, f.middle, f.ring, f.pinky];
  const count = up.filter(Boolean).length;

  if (pinch(lm) && !f.middle && !f.ring && !f.pinky) return 'Pinch';
  if (count === 0) return 'Fist';
  if (count === 4) return 'Open Palm';
  if (f.index && f.middle && !f.ring && !f.pinky) return 'Victory';
  if (f.index && !f.middle && !f.ring && !f.pinky) return 'Pointing';
  return 'Other';
}

// --- ASL fingerspelling (heuristic subset) ---------------------------------
// A trained ST-GCN/Transformer is the roadmap goal; this landmark-rule
// classifier reliably distinguishes a practical subset of static letters so the
// sign-to-voice flow works end-to-end without a dataset. Returns {letter, conf}.
const ASL_RULES = [
  // letter, thumb, index, middle, ring, pinky, requireNoPinch
  { letter: 'B', t: false, i: true, m: true, r: true, p: true },
  { letter: 'L', t: true, i: true, m: false, r: false, p: false },
  { letter: 'V', t: false, i: true, m: true, r: false, p: false },
  { letter: 'U', t: false, i: true, m: true, r: false, p: false, together: true },
  { letter: 'W', t: false, i: true, m: true, r: true, p: false },
  { letter: 'I', t: false, i: false, m: false, r: false, p: true },
  { letter: 'Y', t: true, i: false, m: false, r: false, p: true },
  { letter: 'D', t: false, i: true, m: false, r: false, p: false, pinch: true },
  { letter: 'A', t: true, i: false, m: false, r: false, p: false },
  { letter: 'O', t: false, i: false, m: false, r: false, p: false, pinch: true },
  { letter: 'E', t: false, i: false, m: false, r: false, p: false },
];

export function classifyASL(lm) {
  const f = fingerStates(lm);
  const isPinch = pinch(lm);
  let best = null;
  for (const rule of ASL_RULES) {
    if (rule.pinch && !isPinch) continue;
    if (rule.pinch === false && isPinch && rule.letter !== 'E') continue;
    const match =
      f.thumb === rule.t &&
      f.index === rule.i &&
      f.middle === rule.m &&
      f.ring === rule.r &&
      f.pinky === rule.p;
    if (match) {
      // Disambiguate U vs V by index/middle spread.
      if (rule.together) {
        const spread = dist(lm[TIPS.index], lm[TIPS.middle]);
        if (spread > 0.05) continue; // that's a V, not U
      }
      if (rule.letter === 'V' && !rule.together) {
        const spread = dist(lm[TIPS.index], lm[TIPS.middle]);
        if (spread < 0.05) continue; // too close -> U
      }
      best = rule.letter;
      break;
    }
  }
  return best ? { letter: best, conf: 0.8 } : { letter: null, conf: 0 };
}

// --- Face: gaze + head pose ------------------------------------------------
const NOSE = 1;
const LEFT_CHEEK = 234; // image-left
const RIGHT_CHEEK = 454; // image-right
const FOREHEAD = 10;
const CHIN = 152;
// 6-point eye contours for eye-aspect-ratio (blink detection).
const RIGHT_EYE = [33, 160, 158, 133, 153, 144];
const LEFT_EYE = [362, 385, 387, 263, 373, 380];
const RIGHT_IRIS = 468;
const LEFT_IRIS = 473;

function eyeAspectRatio(lm, pts) {
  const v1 = dist(lm[pts[1]], lm[pts[5]]);
  const v2 = dist(lm[pts[2]], lm[pts[4]]);
  const h = dist(lm[pts[0]], lm[pts[3]]);
  return (v1 + v2) / (2 * h + 1e-6);
}

export function blinkRatio(lm) {
  return Math.min(eyeAspectRatio(lm, RIGHT_EYE), eyeAspectRatio(lm, LEFT_EYE));
}

// Stable head-aim pointer: nose tip mapped into frame coordinates (0..1).
export function gazePoint(lm) {
  const nose = lm[NOSE];
  // Bias with iris offset for finer control when irises are present.
  let gx = nose.x;
  let gy = nose.y;
  if (lm[RIGHT_IRIS] && lm[LEFT_IRIS]) {
    const irisX = (lm[RIGHT_IRIS].x + lm[LEFT_IRIS].x) / 2;
    const irisY = (lm[RIGHT_IRIS].y + lm[LEFT_IRIS].y) / 2;
    gx = 0.7 * nose.x + 0.3 * irisX;
    gy = 0.7 * nose.y + 0.3 * irisY;
  }
  return { x: gx, y: gy };
}

// Rough yaw/pitch/roll in degrees from facial symmetry — enough for tilt nav.
export function headPose(lm) {
  const nose = lm[NOSE];
  const l = lm[LEFT_CHEEK];
  const r = lm[RIGHT_CHEEK];
  const midX = (l.x + r.x) / 2;
  const faceW = Math.abs(r.x - l.x) + 1e-6;
  const yaw = ((nose.x - midX) / faceW) * 90; // + = turned to image-right

  const forehead = lm[FOREHEAD];
  const chin = lm[CHIN];
  const midY = (forehead.y + chin.y) / 2;
  const faceH = Math.abs(chin.y - forehead.y) + 1e-6;
  const pitch = ((nose.y - midY) / faceH) * 90; // + = looking down

  const roll = (Math.atan2(r.y - l.y, r.x - l.x) * 180) / Math.PI; // head tilt
  return { yaw, pitch, roll };
}
