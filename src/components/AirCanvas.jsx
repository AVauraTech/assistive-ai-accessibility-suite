import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Eraser, Languages, Volume2, Send, Check, Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getHandLandmarker, openCamera } from '../lib/mediapipe';
import { classifyGesture, Smoother } from '../lib/gestures';
import { BACKEND, buzz } from '../lib/api';

const STROKE_COLORS = ['#0ca678', '#4dabf7', '#fcc419', '#fa5252', '#b197fc'];

const AirCanvas = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const navigate = useNavigate();

    const strokesRef = useRef([[]]);      // completed + current strokes in normalized coords
    const smootherRef = useRef(new Smoother(0.5));
    const writingRef = useRef(false);
    const rafRef = useRef(null);
    const streamRef = useRef(null);
    const landmarkerRef = useRef(null);

    const [status, setStatus] = useState('Loading model...');
    const [gesture, setGesture] = useState('None');
    const [fps, setFps] = useState(0);
    const [recognizedText, setRecognizedText] = useState('');
    const [showResult, setShowResult] = useState(false);
    const [isRecognizing, setIsRecognizing] = useState(false);
    const [error, setError] = useState(null);

    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        strokesRef.current.forEach((stroke, i) => {
            if (stroke.length < 2) return;
            ctx.beginPath();
            ctx.strokeStyle = STROKE_COLORS[i % STROKE_COLORS.length];
            ctx.moveTo(stroke[0].x * width, stroke[0].y * height);
            for (let j = 1; j < stroke.length - 1; j++) {
                const midX = (stroke[j].x + stroke[j + 1].x) / 2;
                const midY = (stroke[j].y + stroke[j + 1].y) / 2;
                ctx.quadraticCurveTo(stroke[j].x * width, stroke[j].y * height, midX * width, midY * height);
            }
            const last = stroke[stroke.length - 1];
            ctx.lineTo(last.x * width, last.y * height);
            ctx.stroke();
        });
    }, []);

    useEffect(() => {
        let lastVideoTime = -1;
        let frames = 0;
        let lastFpsMark = performance.now();

        const loop = () => {
            const video = videoRef.current;
            const landmarker = landmarkerRef.current;
            rafRef.current = requestAnimationFrame(loop);
            if (!video || video.readyState < 2 || !landmarker) return;

            if (video.currentTime !== lastVideoTime) {
                lastVideoTime = video.currentTime;
                let result;
                try {
                    result = landmarker.detectForVideo(video, performance.now());
                } catch (e) {
                    return;
                }
                frames++;
                const now = performance.now();
                if (now - lastFpsMark >= 1000) {
                    setFps(frames);
                    frames = 0;
                    lastFpsMark = now;
                }

                const hands = result?.landmarks;
                if (hands && hands.length > 0) {
                    const lm = hands[0];
                    const g = classifyGesture(lm);
                    setGesture(g);

                    // Mirror front camera: x -> 1 - x
                    const tip = lm[8];
                    const rawX = 1 - tip.x;
                    const rawY = tip.y;
                    const s = smootherRef.current.update(rawX, rawY);

                    const isWriting = g === 'Pointing';
                    const strokes = strokesRef.current;

                    if (isWriting) {
                        if (!writingRef.current) {
                            // starting a fresh stroke
                            if (strokes[strokes.length - 1].length > 0) strokes.push([]);
                            writingRef.current = true;
                        }
                        const cur = strokes[strokes.length - 1];
                        const lastPt = cur[cur.length - 1];
                        if (!lastPt || Math.hypot(s.x - lastPt.x, s.y - lastPt.y) > 0.008) {
                            cur.push({ x: s.x, y: s.y });
                        }
                    } else if (writingRef.current) {
                        writingRef.current = false;
                        smootherRef.current.reset();
                        buzz(20); // haptic: stroke completed
                    }
                    redraw();
                } else {
                    if (writingRef.current) {
                        writingRef.current = false;
                        buzz(20);
                    }
                    setGesture('None');
                }
            }
        };

        const start = async () => {
            try {
                streamRef.current = await openCamera('user');
                if (videoRef.current) {
                    videoRef.current.srcObject = streamRef.current;
                    await videoRef.current.play();
                }
                setStatus('Starting tracker...');
                landmarkerRef.current = await getHandLandmarker();
                setStatus('Connected (on-device)');
                setError(null);
                rafRef.current = requestAnimationFrame(loop);
            } catch (e) {
                setStatus('Offline');
                setError('Could not start on-device tracking: ' + e.message);
            }
        };
        start();

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        };
    }, [redraw]);

    const handleClear = () => {
        strokesRef.current = [[]];
        writingRef.current = false;
        smootherRef.current.reset();
        redraw();
        buzz(10);
    };

    const handleRecognize = async () => {
        if (!canvasRef.current) return;
        setIsRecognizing(true);
        setError(null);
        try {
            // Composite strokes onto a white background for OCR.
            const src = canvasRef.current;
            const off = document.createElement('canvas');
            off.width = src.width;
            off.height = src.height;
            const octx = off.getContext('2d');
            octx.fillStyle = '#fff';
            octx.fillRect(0, 0, off.width, off.height);
            octx.drawImage(src, 0, 0);
            const image = off.toDataURL('image/png');

            const res = await fetch(`${BACKEND}/api/recognize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image }),
            });
            if (!res.ok) throw new Error('Failed to recognize text');
            const data = await res.json();
            setRecognizedText(data.text);
            setShowResult(true);
            buzz([15, 40, 15]);
        } catch (err) {
            setError('Error recognizing text: ' + err.message);
        } finally {
            setIsRecognizing(false);
        }
    };

    const speakText = () => {
        const u = new SpeechSynthesisUtterance(recognizedText);
        window.speechSynthesis.speak(u);
    };

    const sendToBraille = () => {
        localStorage.setItem('pendingBrailleText', recognizedText);
        navigate('/braille');
    };

    return (
        <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    Air Writing <Cpu size={20} color="var(--color-secondary)" />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>on-device</span>
                </h2>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="status-badge" style={{
                        padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.85rem',
                        background: status.includes('Connected') ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                        color: status.includes('Connected') ? '#10b981' : '#f43f5e',
                    }}>
                        {status.includes('Connected') ? `● Live · ${fps} fps` : `○ ${status}`}
                    </span>
                    {gesture !== 'None' && (
                        <span style={{ padding: '0.5rem 1rem', background: 'rgba(6,182,212,0.15)', color: '#06b6d4', borderRadius: '20px', fontSize: '0.85rem' }}>
                            Gesture: {gesture}
                        </span>
                    )}
                    <button onClick={handleRecognize} className="btn btn-primary" disabled={isRecognizing}>
                        <Languages size={20} /> {isRecognizing ? 'Processing...' : 'Translate to Text'}
                    </button>
                    <button onClick={handleClear} className="btn btn-secondary">
                        <Eraser size={20} /> Clear
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ padding: '1rem', background: 'rgba(244,63,94,0.12)', color: '#fda4af', borderRadius: '8px', marginBottom: '1rem' }}>
                    {error}
                </div>
            )}

            <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', background: '#000', display: 'flex', justifyContent: 'center' }}>
                <video ref={videoRef} playsInline muted style={{ width: '100%', maxWidth: '900px', transform: 'scaleX(-1)', display: 'block', opacity: 0.55 }} />
                <canvas ref={canvasRef} width={900} height={675}
                    style={{ position: 'absolute', inset: 0, width: '100%', maxWidth: '900px', height: 'auto', cursor: 'crosshair' }} />

                {showResult && (
                    <div style={{ position: 'absolute', top: '20px', right: '20px', width: '300px', background: 'rgba(15,23,42,0.95)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)', zIndex: 10 }}>
                        <h4 style={{ margin: '0 0 1rem 0', color: 'var(--color-secondary)' }}>Recognized Text</h4>
                        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', minHeight: '60px', marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 700 }}>
                            {recognizedText || 'No text detected'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button onClick={speakText} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                                <Volume2 size={20} /> Read Aloud
                            </button>
                            <button onClick={sendToBraille} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', background: '#6741d9' }}>
                                <Send size={20} /> To Braille
                            </button>
                            <button onClick={() => setShowResult(false)} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                                <Check size={20} /> Done
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="card" style={{ marginTop: '1rem' }}>
                <h3>How to use</h3>
                <ol style={{ marginLeft: '1.5rem', lineHeight: 2, color: 'var(--text-secondary)' }}>
                    <li>Allow camera access. Tracking now runs <strong>entirely in your browser</strong> (no server round-trip).</li>
                    <li><strong>Point your index finger</strong> up to draw. Curl it (fist) to lift the pen.</li>
                    <li>Each finished stroke gives a short <strong>vibration</strong> on supported devices.</li>
                    <li>Press <strong>Translate to Text</strong> to run OCR on what you drew.</li>
                </ol>
            </div>
        </div>
    );
};

export default AirCanvas;
