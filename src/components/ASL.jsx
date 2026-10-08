import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Hand, Play, Square, Volume2, Trash2, Space, Mic } from 'lucide-react';
import { getHandLandmarker, openCamera } from '../lib/mediapipe';
import { classifyASL } from '../lib/gestures';
import { buzz, speak } from '../lib/api';

// Finger shapes for the text-to-sign visualizer (subset we can render clearly).
const HAND_SHAPES = {
    A: { thumb: true, index: false, middle: false, ring: false, pinky: false },
    B: { thumb: false, index: true, middle: true, ring: true, pinky: true },
    D: { thumb: true, index: true, middle: false, ring: false, pinky: false, pinch: true },
    E: { thumb: false, index: false, middle: false, ring: false, pinky: false },
    I: { thumb: false, index: false, middle: false, ring: false, pinky: true },
    L: { thumb: true, index: true, middle: false, ring: false, pinky: false },
    O: { thumb: true, index: false, middle: false, ring: false, pinky: false, pinch: true },
    U: { thumb: false, index: true, middle: true, ring: false, pinky: false },
    V: { thumb: false, index: true, middle: true, ring: false, pinky: false, spread: true },
    W: { thumb: false, index: true, middle: true, ring: true, pinky: false },
    Y: { thumb: true, index: false, middle: false, ring: false, pinky: true },
};

// Simple SVG hand whose fingers raise/lower per shape.
function HandGlyph({ shape, size = 160 }) {
    const s = shape || {};
    const fingers = [
        { key: 'index', on: s.index, x: 46 },
        { key: 'middle', on: s.middle, x: 66 },
        { key: 'ring', on: s.ring, x: 86 },
        { key: 'pinky', on: s.pinky, x: 104 },
    ];
    return (
        <svg width={size} height={size} viewBox="0 0 150 150">
            {/* palm */}
            <rect x="40" y="70" width="72" height="60" rx="18" fill="#8b5cf6" opacity="0.85" />
            {/* fingers */}
            {fingers.map((f) => {
                const h = f.on ? 58 : 20;
                const y = 78 - h;
                return <rect key={f.key} x={f.x} y={y} width="14" height={h} rx="7" fill="#a78bfa" />;
            })}
            {/* thumb */}
            <rect
                x={s.thumb ? 18 : 30}
                y={s.pinch ? 78 : 86}
                width={s.thumb ? 34 : 22}
                height="14"
                rx="7"
                fill="#c4b5fd"
                transform={s.thumb ? 'rotate(-15 40 90)' : ''}
            />
        </svg>
    );
}

const STABLE_FRAMES = 8; // frames a letter must hold before committing

const ASL = () => {
    const [mode, setMode] = useState('sign-to-voice');
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const landmarkerRef = useRef(null);
    const rafRef = useRef(null);

    const [active, setActive] = useState(false);
    const [status, setStatus] = useState('Idle');
    const [currentLetter, setCurrentLetter] = useState(null);
    const [text, setText] = useState('');
    const [error, setError] = useState(null);
    const stableRef = useRef({ letter: null, count: 0, cooldownUntil: 0 });

    // text-to-sign state
    const [signText, setSignText] = useState('HELLO');
    const [playing, setPlaying] = useState(false);
    const [playIndex, setPlayIndex] = useState(0);

    // --- Sign-to-voice recognition loop ---
    useEffect(() => {
        if (!active || mode !== 'sign-to-voice') return;
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
            const hands = res?.landmarks;
            if (!hands || hands.length === 0) {
                setStatus('Show your hand');
                setCurrentLetter(null);
                stableRef.current = { letter: null, count: 0, cooldownUntil: stableRef.current.cooldownUntil };
                return;
            }
            setStatus('Recognizing');
            const { letter } = classifyASL(hands[0]);
            setCurrentLetter(letter);

            const now = performance.now();
            const st = stableRef.current;
            if (letter && letter === st.letter) {
                st.count++;
            } else {
                st.letter = letter;
                st.count = letter ? 1 : 0;
            }
            if (letter && st.count >= STABLE_FRAMES && now > st.cooldownUntil) {
                st.cooldownUntil = now + 900;
                st.count = 0;
                setText((prev) => prev + letter);
                buzz(18);
            }
        };

        const start = async () => {
            try {
                streamRef.current = await openCamera('user');
                if (videoRef.current) {
                    videoRef.current.srcObject = streamRef.current;
                    await videoRef.current.play();
                }
                landmarkerRef.current = await getHandLandmarker();
                rafRef.current = requestAnimationFrame(loop);
            } catch (e) {
                setError('Could not start tracking: ' + e.message);
                setActive(false);
            }
        };
        start();

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        };
    }, [active, mode]);

    // --- Text-to-sign playback ---
    useEffect(() => {
        if (!playing) return;
        const chars = signText.toUpperCase().replace(/[^A-Z ]/g, '').split('');
        if (playIndex >= chars.length) {
            setPlaying(false);
            setPlayIndex(0);
            return;
        }
        const ch = chars[playIndex];
        if (ch !== ' ') speak(ch, { rate: 0.9 });
        const t = setTimeout(() => setPlayIndex((i) => i + 1), 900);
        return () => clearTimeout(t);
    }, [playing, playIndex, signText]);

    const addSpace = () => setText((p) => p + ' ');
    const clearText = () => {
        setText('');
        buzz(10);
    };

    const currentShape = mode === 'sign-to-voice' ? HAND_SHAPES[currentLetter] : HAND_SHAPES[signText.toUpperCase().replace(/[^A-Z ]/g, '')[playIndex]];

    return (
        <div className="container animate-fade-in">
            <h2 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Hand size={30} color="var(--color-accent)" /> ASL Fingerspelling
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Two-way fingerspelling. <strong>Sign-to-Voice</strong> reads static letters from your hand on-device;
                <strong> Text-to-Sign</strong> animates a hand glyph as it spells and speaks.
                <br /><span style={{ fontSize: '0.85rem', opacity: 0.75 }}>Heuristic subset supported: {Object.keys(HAND_SHAPES).join(', ')} (full ST-GCN continuous ASL is a future upgrade).</span>
            </p>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
                <button className={`btn ${mode === 'sign-to-voice' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setMode('sign-to-voice'); setActive(false); }}>
                    <Mic size={18} /> Sign-to-Voice
                </button>
                <button className={`btn ${mode === 'text-to-sign' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setMode('text-to-sign'); setActive(false); }}>
                    <Hand size={18} /> Text-to-Sign
                </button>
            </div>

            {mode === 'sign-to-voice' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem' }}>
                    <div className="card" style={{ padding: 0, overflow: 'hidden', background: '#000', position: 'relative', aspectRatio: '4/3' }}>
                        <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                        <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: 20, fontSize: '0.85rem' }}>
                            {active ? status : 'Idle'}
                        </div>
                        {currentLetter && (
                            <div style={{ position: 'absolute', bottom: 12, right: 12, fontSize: '4rem', fontWeight: 800, color: '#fff', textShadow: '0 0 20px rgba(139,92,246,0.8)' }}>
                                {currentLetter}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <button className="btn btn-primary" style={{ height: 64, justifyContent: 'center' }} onClick={() => setActive((a) => !a)}>
                            {active ? <Square size={22} /> : <Play size={22} />} {active ? 'Stop' : 'Start Camera'}
                        </button>
                        <div className="card" style={{ marginBottom: 0 }}>
                            <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Recognized</h4>
                            <div style={{ minHeight: 60, fontSize: '1.6rem', fontWeight: 700, letterSpacing: '0.1em' }}>{text || '—'}</div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '1rem', flexWrap: 'wrap' }}>
                                <button className="btn btn-secondary" onClick={addSpace}><Space size={16} /> Space</button>
                                <button className="btn btn-secondary" onClick={() => speak(text)} disabled={!text}><Volume2 size={16} /> Speak</button>
                                <button className="btn btn-secondary" onClick={clearText} disabled={!text}><Trash2 size={16} /> Clear</button>
                            </div>
                        </div>
                        {error && <div style={{ padding: '1rem', background: 'rgba(244,63,94,0.12)', color: '#fda4af', borderRadius: 12 }}>{error}</div>}
                    </div>
                </div>
            ) : (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                    <input
                        value={signText}
                        onChange={(e) => setSignText(e.target.value)}
                        placeholder="Type a word to sign..."
                        style={{ padding: '0.8rem 1rem', fontSize: '1.2rem', borderRadius: 10, border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.25)', color: '#fff', width: '100%', maxWidth: 420, textAlign: 'center', letterSpacing: '0.15em' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                        <HandGlyph shape={currentShape} size={200} />
                        <div style={{ fontSize: '6rem', fontWeight: 800, color: 'var(--color-primary)', minWidth: 120, textAlign: 'center' }}>
                            {signText.toUpperCase().replace(/[^A-Z ]/g, '')[playIndex] || ''}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn btn-primary" onClick={() => { setPlayIndex(0); setPlaying(true); }}><Play size={20} /> Play Signing</button>
                        <button className="btn btn-secondary" onClick={() => setPlaying(false)}><Square size={20} /> Stop</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ASL;
