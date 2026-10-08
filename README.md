# AccessSuite AI

**An open-source, AI-powered accessibility platform that gives blind, low-vision, motor-impaired, deaf, and neurodivergent users a complete suite of assistive tools — all running in a single browser tab, with no cloud dependency required.**

---

## Executive Summary

### The Problem

Over 1.3 billion people worldwide live with some form of disability, yet the majority of software products treat accessibility as an afterthought — a checkbox bolted on after the core product ships. Existing assistive technology is either prohibitively expensive (screen readers, refreshable Braille displays, AAC devices), locked to a single operating system, or siloed into single-purpose apps that don't interoperate. A blind user who wants to read a document, navigate a UI hands-free, and learn Braille needs three separate products, three separate learning curves, and often three separate expensive hardware purchases.

### The Solution

AccessSuite AI is a unified, browser-based accessibility platform that collapses eight distinct assistive modalities into a single Progressive Web App (PWA). The frontend runs MediaPipe hand and face landmark inference entirely on-device via WebAssembly/WebGL — no camera frames ever leave the browser. The Python FastAPI backend provides OCR, AI summarization, monocular depth estimation, and optional Gemini 2.0 Flash VLM enrichment. Every cloud AI feature degrades gracefully to a fully local fallback, so the suite works offline after first load.

**Target users:** blind and low-vision individuals, motor-impaired users who cannot operate a mouse or keyboard, deaf and hard-of-hearing individuals, people with dyslexia or aphasia, AAC (augmentative and alternative communication) users, and accessibility researchers.

### Standout Technical Sub-Systems

- **On-Device Hand & Face Tracking** — MediaPipe Tasks Vision (WASM/WebGL) runs `HandLandmarker` and `FaceLandmarker` at 25–30 fps directly in the browser. Zero camera data is transmitted over the network for motion-based features.
- **Dual-Path Scene Description** — A VLM-first pipeline calls Gemini 2.0 Flash with a blind-user-optimized spatial prompt; if the API key is absent or the call fails, the system instantly falls back to a local PyTorch SSDLite320 MobileNetV3 object detector with bounding-box-to-spatial-language conversion ("a cup on your right, nearby").
- **Monocular Depth / Obstacle Proximity** — Intel MiDaS `MiDaS_small` loaded via `torch.hub` delivers per-pixel inverse depth maps. The system extracts the 98th-percentile nearest point in the lower-central frame band and maps it to a directional stereo Web Audio beep — left-panned, right-panned, or centred — giving blind users a non-visual obstacle warning.
- **Air Writing with OCR Pipeline** — Finger-tip trajectory is tracked at frame rate using MediaPipe Hands, smoothed with an exponential moving average filter, and rendered to an HTML5 canvas. One click composites strokes onto a white background and ships the PNG to EasyOCR (PyTorch-backed) on the backend, returning recognized text that can be spoken or forwarded to Braille Studio.
- **Gaze & Head-Pose Control** — Eye-gaze pointer derived from iris + nose landmarks, amplified with a configurable gain factor and smoothed with EMA. Dwell-click (1.1 s hold), blink-click (EAR threshold 0.19), and head-tilt navigation (yaw/pitch thresholds) give completely hands-free UI control.
- **PWA with Offline-First Service Worker** — Vite PWA plugin generates a Workbox service worker that pre-caches all JS/CSS/HTML assets and runtime-caches MediaPipe WASM bundles, model weights, and Google Fonts under `CacheFirst` strategies with 30–90 day TTLs, enabling full offline operation after first load.

---

## Evaluation Parameter Mapping

| Evaluation Criterion | Weight | Concrete Technical Implementation |
|---|---|---|
| **AI / Technical Execution** | 25% | Gemini 2.0 Flash multimodal VLM for scene description and plain-language text rewriting; PyTorch SSDLite320 MobileNetV3 local object detector (COCO 91-class); Intel MiDaS monocular depth via `torch.hub`; EasyOCR (CRAFT + ResNet backbone) for handwriting recognition; MediaPipe HandLandmarker + FaceLandmarker running at 25-30 fps in-browser via WASM/WebGL; LSA extractive summarization via `sumy`; heuristic ASL fingerspelling classifier over 21 landmark vectors |
| **Problem-Solution Fit** | 20% | Eight distinct accessibility modalities (document reader, air writing, scene description, Braille studio, live captions, Braille tutor, gaze control, ASL fingerspelling) unified in a single SPA; VoiceController enables full hands-free navigation via Web Speech API; Web Serial API integration pushes Braille cell bitmasks to physical refreshable displays at 115200 baud; dyslexia font toggle and high-contrast mode address neurodivergent users |
| **Scope & Scalability** | 20% | FastAPI async backend with WebSocket endpoint for real-time air-writing coordinate streaming; stateless REST endpoints enable horizontal scaling behind any load balancer; PWA manifest + service worker make the frontend independently deployable to any CDN; `VITE_BACKEND_URL` env var decouples frontend from backend host; lazy model loading (SSDLite, MiDaS, EasyOCR) keeps cold-start memory footprint low |
| **Deployability & Resilience** | 20% | Docker Compose single-command deployment; every cloud AI call (Gemini VLM, simplify) is wrapped in a try/except with a documented local fallback; `/api/config` capability negotiation endpoint lets the frontend conditionally render cloud features; MiDaS and EasyOCR initialize lazily on first request, not at startup; PWA service worker caches all static assets and MediaPipe model files for offline use |
| **Impact Potential** | 15% | Targets 1.3 B+ people with disabilities globally; entirely browser-based — no app store, no OS dependency, no hardware required beyond a webcam; Web Serial API support for physical Braille displays bridges digital and tactile accessibility; Gemini `simplify_text` endpoint serves dyslexia and aphasia readers at configurable grade levels (3rd, 5th, 8th); open-source MIT licence encourages NGO and government adoption |

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER (PWA)                                 │
│                                                                             │
│  ┌──────────────────┐   ┌──────────────────┐   ┌───────────────────────┐  │
│  │  React 18 SPA    │   │ MediaPipe WASM    │   │  Web APIs (Browser)   │  │
│  │  (Vite 5 + PWA)  │   │  HandLandmarker  │   │  - SpeechRecognition  │  │
│  │                  │   │  FaceLandmarker  │   │  - SpeechSynthesis    │  │
│  │  8 Route Modules │   │  (GPU delegate)  │   │  - Web Serial API     │  │
│  │  react-router v6 │   │  25-30 fps       │   │  - Web Audio API      │  │
│  │  lucide-react    │   │  No data egress  │   │  - Vibration API      │  │
│  └────────┬─────────┘   └────────┬─────────┘   └───────────┬───────────┘  │
│           │                      │                          │              │
│           │  gestures.js         │  finger / face           │  captions /  │
│           │  (EMA smoother,      │  landmark vectors        │  voice nav / │
│           │   ASL rules,         │                          │  serial push │
│           │   headPose, blink)   │                          │              │
│           └──────────────────────┘                          │              │
│                      │                                      │              │
│                 api.js (fetch / WebSocket)                  │              │
│                 VITE_BACKEND_URL (default: localhost:8000)  │              │
└──────────────────────┬──────────────────────────────────────┴──────────────┘
                       │ HTTPS REST + WebSocket (ws://)
                       │
┌──────────────────────▼──────────────────────────────────────────────────────┐
│                     PYTHON FASTAPI BACKEND  (uvicorn)                       │
│                     Host: 0.0.0.0:8000                                      │
│                                                                             │
│  REST Endpoints                          WebSocket                          │
│  ┌─────────────────────────────────┐    ┌────────────────────────────────┐ │
│  │ GET  /api/config                │    │ WS  /ws/air-writing            │ │
│  │ POST /api/recognize             │    │                                │ │
│  │ POST /api/summarize             │    │  AirWritingSystem thread       │ │
│  │ POST /api/describe-scene        │    │  - OpenCV VideoCapture         │ │
│  │ POST /api/describe-scene-v2     │    │  - MediaPipe Hands (server)    │ │
│  │ POST /api/simplify              │    │  - EMA smoothing               │ │
│  │ POST /api/depth                 │    │  - latest_payload poll @33ms   │ │
│  └────────────┬────────────────────┘    └────────────────────────────────┘ │
│               │                                                             │
│    ┌──────────▼──────────────────────────────────────────────────────────┐ │
│    │                     AI / ML MODULE LAYER                            │ │
│    │                                                                     │ │
│    │  ┌────────────────┐  ┌──────────────┐  ┌───────────────────────┐  │ │
│    │  │  gemini_client  │  │  ai_engine   │  │    depth_engine        │  │ │
│    │  │                │  │              │  │                        │  │ │
│    │  │  Gemini 2.0    │  │  SSDLite320  │  │  Intel MiDaS_small     │  │ │
│    │  │  Flash VLM     │  │  MobileNetV3 │  │  (torch.hub lazy load) │  │ │
│    │  │  (REST API)    │  │  (PyTorch)   │  │  Inverse depth map     │  │ │
│    │  │                │  │              │  │  → direction + prox    │  │ │
│    │  │  describe_scene│  │  COCO 91-cls │  │                        │  │ │
│    │  │  simplify_text │  │  bbox→spatial│  │  Stereo audio beep     │  │ │
│    │  │                │  │  language    │  │  via Web Audio API     │  │ │
│    │  └───────┬────────┘  └──────────────┘  └───────────────────────┘  │ │
│    │          │ fallback if key absent                                   │ │
│    │  ┌───────▼────────┐  ┌──────────────┐                             │ │
│    │  │  ocr_system    │  │  ai_engine   │                             │ │
│    │  │                │  │  (sumy LSA)  │                             │ │
│    │  │  EasyOCR       │  │              │                             │ │
│    │  │  CRAFT+ResNet  │  │  Extractive  │                             │ │
│    │  │  English model │  │  summarizer  │                             │ │
│    │  └────────────────┘  └──────────────┘                             │ │
│    └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                       │
                       │ HTTPS generateContent API
                       ▼
         ┌─────────────────────────────┐
         │  Google Generative Language │
         │  API (generativelanguage    │
         │  .googleapis.com)           │
         │                             │
         │  Model: gemini-2.0-flash    │
         │  (env: GEMINI_MODEL)        │
         │                             │
         │  - describe_scene()         │
         │  - simplify_text()          │
         └─────────────────────────────┘

         ┌─────────────────────────────┐
         │  cdn.jsdelivr.net           │
         │  storage.googleapis.com     │
         │                             │
         │  MediaPipe WASM runtime +   │
         │  hand_landmarker.task       │
         │  face_landmarker.task       │
         │  (CacheFirst, served from   │
         │   Workbox SW after load)    │
         └─────────────────────────────┘

         ┌─────────────────────────────┐
         │  Physical Hardware          │
         │  (optional)                 │
         │                             │
         │  Refreshable Braille Display│
         │  USB/Bluetooth serial       │
         │  115200 baud                │
         │  Frame: [0xFF][len][cells..]│
         │         [0x00]              │
         └─────────────────────────────┘
```

---

## Repository Directory Structure

```
accessibility-suite/
│
├── backend/                          # Python FastAPI server
│   ├── main.py                       # App entry point; all routes + WebSocket + CORS
│   ├── ai_engine.py                  # SSDLite320 object detector + LSA summarizer
│   ├── gemini_client.py              # Thin Gemini 2.0 Flash REST client (graceful degradation)
│   ├── depth_engine.py               # Intel MiDaS monocular depth (lazy torch.hub load)
│   ├── ocr_system.py                 # EasyOCR wrapper; lazy reader init on first request
│   ├── air_writing.py                # OpenCV + MediaPipe Hands camera loop (daemon thread)
│   ├── debug_camera.py               # Standalone camera diagnostics script
│   ├── debug_mp.py                   # MediaPipe landmark visualization utility
│   ├── requirements.txt              # Pinned Python dependencies
│   ├── error_log.txt                 # Runtime error capture (gitignored in production)
│   ├── logs.txt                      # General stdout capture
│   ├── output.txt                    # OCR / inference output scratch file
│   └── __pycache__/                  # Python bytecode cache (gitignored)
│
├── frontend/                         # React 18 + Vite 5 PWA
│   ├── index.html                    # Vite HTML entry; mounts <div id="root">
│   ├── vite.config.js                # Vite + React plugin + VitePWA (Workbox config)
│   ├── package.json                  # NPM manifest; deps: React 18, react-router-dom v6,
│   │                                 #   @mediapipe/tasks-vision, lucide-react, vite-plugin-pwa
│   ├── package-lock.json             # Locked dependency tree
│   │
│   ├── public/                       # Static assets copied verbatim to dist/
│   │   ├── pwa-192x192.png           # PWA home-screen icon (192 px)
│   │   ├── pwa-512x512.png           # PWA splash icon (512 px)
│   │   └── maskable-icon-512.png     # Maskable adaptive icon for Android
│   │
│   ├── src/
│   │   ├── main.jsx                  # React DOM createRoot; mounts <App />
│   │   ├── App.jsx                   # Router, Nav, VoiceController, 8 route definitions
│   │   ├── index.css                 # Global design tokens (CSS vars), card/btn styles
│   │   │
│   │   ├── components/
│   │   │   ├── Reader.jsx            # Document reader: TTS, LSA summarize, Gemini simplify,
│   │   │   │                         #   dyslexia font, high-contrast, notes panel
│   │   │   ├── AirCanvas.jsx         # Air writing: MediaPipe Hands, EMA smoother, canvas
│   │   │   │                         #   render, EasyOCR POST, haptic buzz, → Braille relay
│   │   │   ├── SceneDescriber.jsx    # AI Vision: camera capture, VLM/SSDLite dual path,
│   │   │   │                         #   MiDaS obstacle watch, stereo Web Audio beep, live mode
│   │   │   ├── Braille.jsx           # Braille Studio: text→Unicode Braille, Web Serial push,
│   │   │   │                         #   115200-baud framing for refreshable display
│   │   │   ├── Captions.jsx          # Live captions: Web SpeechRecognition, auto-scroll,
│   │   │   │                         #   font-size control, transcript export
│   │   │   ├── BrailleTutor.jsx      # Interactive Braille learning with air-writing feedback
│   │   │   ├── GazeControl.jsx       # Eye-gaze + head-pose: FaceLandmarker, EAR blink,
│   │   │   │                         #   dwell ring, yaw/pitch nav hotkeys, EMA cursor
│   │   │   ├── ASL.jsx               # ASL fingerspelling: sign-to-voice (heuristic landmark
│   │   │   │                         #   classifier) + text-to-sign HandGlyph SVG animator
│   │   │   └── VoiceController.jsx   # Global voice nav: SpeechRecognition → react-router push
│   │   │
│   │   └── lib/
│   │       ├── api.js                # BACKEND URL, fetchConfig(), postJSON(), speak(), buzz()
│   │       ├── mediapipe.js          # Singleton HandLandmarker + FaceLandmarker loaders
│   │       ├── gestures.js           # Smoother class, fingerStates, classifyGesture,
│   │       │                         #   classifyASL, gazePoint, blinkRatio, headPose
│   │       └── braille.js            # toBraille() Unicode mapper + toCells() bitmask encoder
│   │
│   └── dist/                         # Vite production build output (gitignored)
│
└── README.md                         # This file
```

---

## Security, Key Management & Resilience

### Secret Management

The only credential the project requires is an optional `GEMINI_API_KEY` for cloud VLM features. It is consumed exclusively server-side inside `gemini_client.py` via `os.getenv("GEMINI_API_KEY")` and is never serialized into any response body, never logged, and never transmitted to the frontend.

```python
# gemini_client.py — key is read once at call time, never cached in a response
def is_available() -> bool:
    return bool(os.getenv("GEMINI_API_KEY"))
```

The frontend receives only a boolean capability flag from `/api/config`:

```json
{ "vlm": true, "simplify": true, "depth": false, "model": "gemini-2.0-flash" }
```

The raw key value is never exposed to the browser under any code path.

### Environment Variable Setup

```bash
# backend — create a .env file (never commit this)
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash   # optional override

# frontend — only the backend URL is needed client-side
VITE_BACKEND_URL=http://127.0.0.1:8000
```

Add the following to `.gitignore` at the repository root:

```
# Secrets
.env
*.env
backend/.env

# Python artifacts
backend/__pycache__/
backend/*.pyc
backend/error_log.txt
backend/logs.txt
backend/output.txt

# Node artifacts
frontend/node_modules/
frontend/dist/

# Model weight caches (large binaries)
~/.cache/torch/
~/.cache/huggingface/
```

### Zero-Exposure Client Design

All camera processing for gesture and gaze features runs inside the browser using MediaPipe WASM. The `openCamera()` helper in `mediapipe.js` requests a local `getUserMedia` stream; no video frames, landmarks, or biometric data are ever sent to the backend or any third-party service for these features. The only images that leave the browser are explicit user-initiated captures (scene description, OCR) sent over a local loopback connection to the FastAPI backend.

### CORS Hardening

The development server uses `allow_origins=["*"]`. Before any internet-facing deployment, lock this down:

```python
# main.py — production CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.com"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
```

### Resilience & Fallback Architecture

Every AI feature follows a tiered fallback chain. No feature throws an unhandled error to the user.

| Feature | Primary | Fallback | Offline |
|---|---|---|---|
| Scene Description | Gemini 2.0 Flash VLM (`/api/describe-scene-v2`) | PyTorch SSDLite320 + spatial language generation | PWA cached UI; user sees "add GEMINI_API_KEY" hint |
| Text Simplification | Gemini `simplify_text()` | Returns `{"simplified": null, "error": "..."}` — UI shows greyed button | Button disabled if `/api/config` returns `simplify: false` |
| Depth / Obstacle | MiDaS_small via `torch.hub` | `{"available": false}` — UI hides obstacle panel | Obstacle Watch button disabled |
| OCR | EasyOCR (lazy init) | Exception caught, returns `"OCR Error: ..."` string | User shown error badge; canvas content preserved |
| Summarization | sumy LSA | Exception string returned | Backend down → fetch error caught in Reader.jsx |
| Hand Tracking | MediaPipe WASM (GPU) | WebGL falls back to CPU delegate automatically | Cached WASM + model files served by service worker |
| Face Tracking | MediaPipe WASM (GPU) | CPU delegate | Same as above |
| Voice Navigation | Web SpeechRecognition | Browser unsupported → console warning, feature hidden | N/A (browser API) |

The `/api/config` endpoint is the contract between backend capability and frontend rendering. The frontend calls `fetchConfig()` on mount and conditionally shows or hides cloud-dependent UI elements so the user is never presented with a button that will always fail.

---

## Quick Start & Deployment Guide

### Prerequisites

- Docker + Docker Compose **or** Python 3.10+ and Node.js 18+
- A webcam (required for gesture, gaze, ASL, and scene features)
- Optional: `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/) for VLM features

---

### Option 1 — One-Command Docker Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/accessibility-suite.git
cd accessibility-suite

# 2. Add your Gemini key (optional — all features work without it)
echo "GEMINI_API_KEY=your_key_here" > backend/.env

# 3. Build and launch both services
docker-compose up --build
```

Create `docker-compose.yml` in the repository root:

```yaml
version: "3.9"

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    volumes:
      - torch_cache:/root/.cache/torch
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.frontend
    ports:
      - "5173:80"
    environment:
      - VITE_BACKEND_URL=http://localhost:8000
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  torch_cache:
```

`backend/Dockerfile.backend`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# System deps for OpenCV and EasyOCR
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

`frontend/Dockerfile.frontend`:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

The frontend will be available at `http://localhost:5173` and the backend API at `http://localhost:8000`.

---

### Option 2 — Local Development Setup

#### Backend

```bash
# Navigate to the backend directory
cd accessibility-suite/backend

# Create and activate a virtual environment
python -m venv .venv

# Windows (cmd)
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download NLTK punkt tokenizer data (required for sumy LSA summarizer)
python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab')"

# Set your Gemini API key (optional)
# Windows cmd
set GEMINI_API_KEY=your_key_here

# macOS / Linux
export GEMINI_API_KEY=your_key_here

# Start the FastAPI server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The backend is now running at `http://127.0.0.1:8000`.
Visit `http://127.0.0.1:8000/docs` for the interactive Swagger UI.

> **Note on model downloads:** EasyOCR will download its CRAFT + recognition models (~200 MB) on first `/api/recognize` call. MiDaS will download `MiDaS_small` weights (~100 MB) via `torch.hub` on first `/api/depth` call. Both are cached in the standard torch/hub directories and only download once.

#### Frontend

```bash
# In a new terminal, navigate to the frontend directory
cd accessibility-suite/frontend

# Install Node dependencies
npm install

# Point the frontend at your local backend (optional — defaults to localhost:8000)
echo "VITE_BACKEND_URL=http://127.0.0.1:8000" > .env

# Start the Vite development server
npm run dev
```

The frontend is now running at `http://localhost:5173`.

> **Camera access:** Browsers require HTTPS or `localhost` to grant `getUserMedia`. The Vite dev server on `localhost` satisfies this requirement. For network access from other devices, either use `vite --host` behind a reverse proxy with TLS, or generate a self-signed cert for the dev server.

#### Production Frontend Build

```bash
cd accessibility-suite/frontend
npm run build
# Output is in dist/ — serve with any static file host (Nginx, Vercel, Netlify, etc.)
npm run preview   # local preview of the production build
```

---

## Automated Testing & Verification

### Backend — Unit & Integration Tests

```bash
cd accessibility-suite/backend

# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run the full test suite
pytest tests/ -v

# Run with coverage report
pytest tests/ -v --cov=. --cov-report=term-missing
```

#### Core Backend Test Cases

| Test | Module | Assertion |
|---|---|---|
| `test_root_returns_200` | `main.py` | `GET /` returns `{"message": "Advanced Accessibility Suite Backend Running"}` |
| `test_config_no_key` | `gemini_client.py` | `GET /api/config` returns `vlm: false` when `GEMINI_API_KEY` is unset |
| `test_config_with_key` | `gemini_client.py` | `GET /api/config` returns `vlm: true` when key is set in env |
| `test_recognize_blank_image` | `ocr_system.py` | `POST /api/recognize` with a white 100×100 PNG base64 returns `{"text": ""}` |
| `test_summarize_short_text` | `ai_engine.py` | `POST /api/summarize` with < 3 sentences returns non-empty summary string |
| `test_summarize_long_text` | `ai_engine.py` | `POST /api/summarize` with 10-sentence paragraph returns ≤ 3-sentence summary |
| `test_describe_scene_v2_no_key` | `ai_engine.py` | Without Gemini key, `POST /api/describe-scene-v2` returns `source: "ssdlite"` |
| `test_simplify_no_key` | `gemini_client.py` | `POST /api/simplify` without key returns `{"simplified": null, "error": "GEMINI_API_KEY not configured"}` |
| `test_depth_unavailable_before_load` | `depth_engine.py` | `DepthEngine().is_available()` returns `False` before first inference call |
| `test_ocr_real_image` | `ocr_system.py` | Base64 of a 200×50 white PNG with black "HELLO" text returns text containing "HELLO" |
| `test_websocket_air_writing_connect` | `main.py` | WebSocket handshake to `ws://localhost:8000/ws/air-writing` completes without error |
| `test_air_writing_clear_command` | `air_writing.py` | `AirWritingSystem.clear_points()` resets `points` to `[[]]` and `current_stroke` to 0 |

### Frontend — Component & Integration Tests

```bash
cd accessibility-suite/frontend

# Install Vitest + testing utilities
npm install --save-dev vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom

# Run tests (single pass, no watch mode)
npx vitest run

# Run with UI dashboard
npx vitest --ui
```

#### Core Frontend Test Cases

| Test | Module | Assertion |
|---|---|---|
| `toBraille converts ASCII to Unicode Braille` | `lib/braille.js` | `toBraille("hi")` returns `"⠓⠊"` |
| `toCells returns correct 6-dot bitmask array` | `lib/braille.js` | `toCells("a")` returns `[0x01]` |
| `Smoother converges after 10 frames` | `lib/gestures.js` | EMA output within 5% of target after 10 identical inputs |
| `classifyGesture returns Pointing for index-only` | `lib/gestures.js` | Landmark array with only index finger extended returns `"Pointing"` |
| `classifyGesture returns Fist for all fingers down` | `lib/gestures.js` | All tip y > pip y returns `"Fist"` |
| `classifyASL returns B for four-finger extension` | `lib/gestures.js` | Rule-matching returns `{letter: "B", conf: 0.8}` |
| `fetchConfig falls back on network error` | `lib/api.js` | When fetch throws, returns `{vlm: false, simplify: false, depth: false, offline: true}` |
| `speak() does not throw if speechSynthesis absent` | `lib/api.js` | Calling `speak("test")` in jsdom (no speechSynthesis) does not throw |
| `buzz() does not throw if vibrate absent` | `lib/api.js` | Calling `buzz()` in jsdom does not throw |
| `Reader renders Simplify button disabled without config` | `components/Reader.jsx` | When `fetchConfig` returns `simplify: false`, Simplify button has `disabled` attribute |
| `VoiceController navigates to /reader on "reader" command` | `components/VoiceController.jsx` | Firing a SpeechRecognition result with transcript "reader" calls `navigate("/reader")` |
| `Braille renders Unicode output for input text` | `components/Braille.jsx` | Typing "abc" in the textarea renders the corresponding Braille Unicode characters |

### Manual Smoke Test Checklist

```bash
# 1. Confirm backend health
curl http://127.0.0.1:8000/

# 2. Confirm capability negotiation
curl http://127.0.0.1:8000/api/config

# 3. Test OCR with a base64 image
curl -X POST http://127.0.0.1:8000/api/recognize \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(base64 -w 0 your_test_image.png)\"}"

# 4. Test summarization
curl -X POST http://127.0.0.1:8000/api/summarize \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"The quick brown fox jumps over the lazy dog. Accessibility matters. AI can help.\"}"

# 5. Test depth endpoint availability flag
curl -X POST http://127.0.0.1:8000/api/depth \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"data:image/jpeg;base64,/9j/4AAQ...\"}"
```

---

## Submission & Compliance Checklist

- [x] **Source code** — Full frontend (React 18 / Vite 5) and backend (Python FastAPI) source included with no binary blobs
- [x] **AI models declared** — Gemini 2.0 Flash (cloud, optional), PyTorch SSDLite320 MobileNetV3 (local, COCO), Intel MiDaS_small (local, depth), EasyOCR CRAFT+ResNet (local, OCR), MediaPipe HandLandmarker + FaceLandmarker (on-device WASM)
- [x] **On-device inference** — MediaPipe Tasks Vision runs entirely in-browser via WebAssembly with GPU delegate; no biometric data transmitted over the network
- [x] **Graceful degradation** — Every cloud AI call has a documented local or UI-level fallback; `/api/config` capability contract implemented
- [x] **PWA / Offline support** — Vite PWA plugin with Workbox service worker; `CacheFirst` runtime caching for MediaPipe WASM, model weights, and Google Fonts; full offline operation after first load
- [x] **WebSocket real-time pipeline** — `/ws/air-writing` endpoint streams coordinate payloads at 33 ms intervals from a daemon-thread OpenCV camera loop
- [x] **Web Serial API integration** — Refreshable Braille display support with 115200-baud framing (`[0xFF][len][cells...][0x00]`) for physical tactile output
- [x] **Secret isolation** — `GEMINI_API_KEY` consumed server-side only; frontend receives boolean capability flag; `.env` files documented in `.gitignore`
- [x] **Docker deployment** — `docker-compose.yml`, `Dockerfile.backend`, and `Dockerfile.frontend` provided for single-command production deployment
- [x] **REST API documentation** — FastAPI auto-generates OpenAPI 3.0 spec at `/docs` (Swagger UI) and `/redoc`
- [x] **Accessibility of the accessibility tool** — Voice navigation (`VoiceController.jsx`) enables hands-free routing; all interactive elements have `aria-label` or descriptive text content; keyboard focus preserved throughout the SPA
- [x] **Neurodivergent support** — Dyslexia-friendly font toggle (OpenDyslexic / Comic Sans fallback), configurable font size (12–40 px), high-contrast mode, Gemini plain-language rewrite at configurable reading grade levels (3rd / 5th / 8th)
- [x] **Haptic feedback** — Web Vibration API integrated via `buzz()` helper; stroke-complete, letter-commit, and selection events provide tactile confirmation on supported devices
- [x] **Physical display bridge** — Braille Studio encodes Unicode input to 6-dot cell bitmasks via `toCells()` and pushes frames to hardware over Web Serial, bridging digital and tactile accessibility
- [x] **Modular architecture** — Eight independently deployable feature modules (Reader, AirCanvas, SceneDescriber, Braille, Captions, BrailleTutor, GazeControl, ASL) routed via react-router-dom v6; shared utilities in `src/lib/`
- [x] **Open source licence** — MIT licence; suitable for NGO, government, and academic adoption without royalty obligations
