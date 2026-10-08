import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Play, Square, MousePointer2, Volume2 } from 'lucide-react';
import { getFaceLandmarker, openCamera } from '../lib/mediapipe';
import { gazePoint, blinkRatio, headPose, Smoother } from '../lib/gestures';
import { buzz, speak } from '../lib/api';

const DWELL_MS = 1100;
const BLINK_THRESHOLD = 0.19;
const GAIN = 1.7; // amplify small head/eye movement to full-screen reach

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const GazeControl = () => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const landmarkerRef = useRef(null);
    const rafRef = useRef(null);
    const smootherRef = useRef(new Smoother(0.35));
    const cursorRef = useRef(null);
    const dwellState = useRef({ el: null, start: 0, cooldownUntil: 0 });
    const blinkState = useRef({ closed: false, cooldownUntil: 0 });
    const navState = useRef({ cooldownUntil: 0 });
    const navigate = useNavigate();

    const [active, setActive] = useState(false);
    const [status, setStatus] = useState('Idle');
    const [dwellPct, setDwellPct] = useState(0);
    const [error, setError] = useState(null);
    const [lastAction, setLastAction] = useState('—');

    const triggerClick = useCallback((el, how) => {
        const now = performance.now();
        if (now < dwellState.current.cooldownUntil) return;
        dwellState.current.cooldownUntil = now + 700;
        buzz([12, 30, 12]);
        const label = el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30) || 'target';
        setLastAction(`${how}: ${label}`);
        el.click();
    }, []);

    useEffect(() => {
        if (!active) return;
        let lastVideoTime = -1;

        const loop = () => {
            rafRef.current = requestAnimationFrame(loop);
            const video = videoRef.current;
            const lm = landmarkerRef.current;
            if (!video || video.readyState < 2 || !lm) return;
            if (video.currentTime === lastVideoTime) return;
            lastVideoTime = video.currentTime;

            let res;
            try {
                res = lm.detectForVideo(video, performance.now());
            } catch {
                return;
            }
            const faces = res?.faceLandmarks;
            if (!faces || faces.length === 0) {
                setStatus('No face detected');
                return;
            }
            setStatus('Tracking');
            const face = faces[0];

            // --- Gaze cursor (mirrored, amplified) ---
            const g = gazePoint(face);
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const nx = clamp(((1 - g.x) - 0.5) * GAIN + 0.5, 0, 1);
            const ny = clamp((g.y - 0.5) * GAIN + 0.5, 0, 1);
            const s = smootherRef.current.update(nx * vw, ny * vh);
            if (cursorRef.current) {
                cursorRef.current.style.transform = `translate(${s.x}px, ${s.y}px)`;
            }

            // --- Dwell click on .gaze-target under the cursor ---
            const el = document.elementFromPoint(s.x, s.y);
            const target = el && el.closest ? el.closest('.gaze-target') : null;
            const now = performance.now();
            if (target && target !== dwellState.current.el) {
                dwellState.current.el = target;
                dwellState.current.start = now;
            } else if (!target) {
                dwellState.current.el = null;
                setDwellPct(0);
            }
            if (target) {
                const pct = clamp(((now - dwellState.current.start) / DWELL_MS) * 100, 0, 100);
                setDwellPct(pct);
                if (pct >= 100) {
                    triggerClick(target, 'Dwell');
                    dwellState.current.start = now + 99999; // require re-entry
                    setDwellPct(0);
                }
            }

            // --- Blink click ---
            const ear = blinkRatio(face);
            const b = blinkState.current;
            if (ear < BLINK_THRESHOLD) {
                b.closed = true;
            } else if (b.closed) {
                b.closed = false;
                if (now > b.cooldownUntil && target) {
                    b.cooldownUntil = now + 800;
                    triggerClick(target, 'Blink');
                }
            }

            // --- Head-pose navigation hotkeys ---
            const pose = headPose(face);
            const nav = navState.current;
            if (now > nav.cooldownUntil) {
                if (pose.yaw > 28) {
                    nav.cooldownUntil = now + 1200;
                    setLastAction('Head right → Vision');
                    navigate('/scene-describer');
                } else if (pose.yaw < -28) {
                    nav.cooldownUntil = now + 1200;
                    setLastAction('Head left → Reader');
                    navigate('/reader');
                } else if (pose.pitch > 22) {
                    nav.cooldownUntil = now + 800;
                    window.scrollBy({ top: 240, behavior: 'smooth' });
                    setLastAction('Nod down → scroll');
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
                landmarkerRef.current = await getFaceLandmarker();
                rafRef.current = requestAnimationFrame(loop);
                speak('Gaze control active. Look at a button and hold, or blink, to select it.');
            } catch (e) {
                setError('Could not start gaze tracking: ' + e.message);
                setActive(false);
            }
        };
        start();

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
            smootherRef.current.reset();
        };
    }, [active, navigate, triggerClick]);

    const demoButtons = [
        { label: 'Read Aloud', icon: <Volume2 />, to: null, act: () => speak('Gaze selection works. Nice.') },
        { label: 'Document Reader', icon: <Eye />, to: '/reader' },
        { label: 'AI Vision', icon: <MousePointer2 />, to: '/scene-describer' },
        { label: 'Air Writing', icon: <MousePointer2 />, to: '/air-write' },
    ];

    return (
        <div className="container animate-fade-in">
            <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <MousePointer2 size={30} color="var(--color-secondary)" /> Eye-Gaze & Head-Pose Control
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Hands-free pointer for users who cannot use their hands. The cursor follows your gaze/head;
                <strong> dwell</strong> or <strong>blink</strong> on a highlighted button to activate it. Tilt your head to navigate.
            </p>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => setActive((a) => !a)}>
                    {active ? <Square size={20} /> : <Play size={20} />} {active ? 'Stop Tracking' : 'Start Tracking'}
                </button>
                <span style={{ padding: '0.5rem 1rem', borderRadius: '20px', background: 'rgba(255,255,255,0.06)', fontSize: '0.9rem' }}>
                    {active ? status : 'Idle'}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Last action: {lastAction}</span>
            </div>

            {error && <div style={{ padding: '1rem', background: 'rgba(244,63,94,0.12)', color: '#fda4af', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}

            <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Try it — gaze targets</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: '1rem' }}>
                    {demoButtons.map((b) => (
                        <button
                            key={b.label}
                            className="gaze-target btn btn-secondary"
                            style={{ padding: '1.5rem', fontSize: '1.1rem', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}
                            onClick={() => (b.to ? navigate(b.to) : b.act && b.act())}
                        >
                            {b.icon} {b.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Hidden camera feed */}
            <video ref={videoRef} playsInline muted style={{ position: 'fixed', bottom: 10, right: 10, width: 160, borderRadius: 12, opacity: active ? 0.7 : 0, zIndex: 900, transition: 'opacity .3s' }} />

            {/* Full-screen gaze cursor + dwell ring */}
            {active && (
                <div ref={cursorRef} style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 2000 }}>
                    <div style={{ position: 'absolute', width: 34, height: 34, marginLeft: -17, marginTop: -17, borderRadius: '50%', border: '2px solid var(--color-secondary)', boxShadow: '0 0 12px rgba(6,182,212,0.7)' }}>
                        <svg width="34" height="34" style={{ position: 'absolute', inset: -2, transform: 'rotate(-90deg)' }}>
                            <circle cx="17" cy="17" r="16" fill="none" stroke="rgba(6,182,212,0.9)" strokeWidth="3"
                                strokeDasharray={`${(dwellPct / 100) * 100.5} 100.5`} />
                        </svg>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GazeControl;
