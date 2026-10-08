// Client-side MediaPipe loaders (v2.0 edge-AI). Runs hand + face landmark
// inference in the browser via WASM/WebGL, removing the WebSocket round-trip.
// Landmarkers are created once and shared across modules.
import { FilesetResolver, HandLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';

const VERSION = '1.0.1';
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const HAND_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let filesetPromise = null;
let handPromise = null;
let facePromise = null;

function getFileset() {
  if (!filesetPromise) {
    filesetPromise = FilesetResolver.forVisionTasks(WASM_BASE);
  }
  return filesetPromise;
}

export function getHandLandmarker() {
  if (!handPromise) {
    handPromise = getFileset().then((fileset) =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
    );
  }
  return handPromise;
}

export function getFaceLandmarker() {
  if (!facePromise) {
    facePromise = getFileset().then((fileset) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        outputFaceBlendshapes: false,
        numFaces: 1,
      })
    );
  }
  return facePromise;
}

// Convenience: request a camera stream (front-facing for gaze/hands).
export async function openCamera(facingMode = 'user') {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  return stream;
}
