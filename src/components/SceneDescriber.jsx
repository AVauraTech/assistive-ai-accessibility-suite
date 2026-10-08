import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, Eye, Volume2, RefreshCw, Radar, Sparkles } from 'lucide-react';
import { BACKEND, fetchConfig, postJSON, speak } from '../lib/api';

const SceneDescriber = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const audioCtxRef = useRef(null);
    const liveTimer = useRef(null);

    const [description, setDescription] = useState('');
    const [source, setSource] = useState(null);
    const [objects, setObjects] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [config, setConfig] = useState({ vlm: false, depth: false });
    const [live, setLive] = useState(false);
    const [obstacleWatch, setObstacleWatch] = useState(false);
    const [obstacle, setObstacle] = useState(null);

    useEffect(() => {
        fetchConfig().then(setConfig);
        startCamera();
        return () => {
            stopCamera();
            if (liveTimer.current) clearInterval(liveTimer.current);
            if (audioCtxRef.current) audioCtxRef.current.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) {
            setError('Could not access camera: ' + err.message);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
        }
    };

    const capture = () => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video || !video.videoWidth) return null;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.8);
    };

    // Directional beep via Web Audio stereo panner.
    const panBeep = useCallback((direction) => {
        try {
            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const ctx = audioCtxRef.current;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
            osc.type = 'sine';
            osc.frequency.value = direction === 'ahead' ? 880 : 660;
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
            osc.connect(gain);
            if (panner) {
                panner.pan.value = direction === 'left' ? -0.8 : direction === 'right' ? 0.8 : 0;
                gain.connect(panner);
                panner.connect(ctx.destination);
            } else {
                gain.connect(ctx.destination);
            }
            osc.start();
            osc.stop(ctx.currentTime + 0.26);
        } catch {
            /* audio unavailable */
        }
    }, []);

    const handleDescribe = useCallback(async () => {
        const image = capture();
        if (!image) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await postJSON('/api/describe-scene-v2', { image });
            setDescription(data.description || '');
            setSource(data.source || null);
            setObjects(data.objects || []);
            if (data.description) speak(data.description);
        } catch (err) {
            setError('Error: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const checkObstacle = useCallback(async () => {
        const image = capture();
        if (!image) return;
        try {
            const data = await postJSON('/api/depth', { image });
            if (!data.available) {
                setObstacle({ msg: 'Depth model not loaded on backend.' });
                return;
            }
            setObstacle(data);
            if (data.proximity > 0.72) {
                panBeep(data.direction);
                speak(`Obstacle ${data.direction}, very close.`);
            } else if (data.proximity > 0.5) {
                panBeep(data.direction);
            }
        } catch (err) {
            setObstacle({ msg: 'Depth error: ' + err.message });
        }
    }, [panBeep]);

    // Live description loop
    useEffect(() => {
        if (live) {
            handleDescribe();
            liveTimer.current = setInterval(handleDescribe, 4000);
        } else if (liveTimer.current) {
            clearInterval(liveTimer.current);
            liveTimer.current = null;
        }
        return () => liveTimer.current && clearInterval(liveTimer.current);
    }, [live, handleDescribe]);

    // Obstacle watch loop
    useEffect(() => {
        let t = null;
        if (obstacleWatch) {
            checkObstacle();
            t = setInterval(checkObstacle, 1500);
        }
        return () => t && clearInterval(t);
    }, [obstacleWatch, checkObstacle]);

    return (
        <div className="container">
            <h2 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <Eye size={32} color="var(--color-primary)" /> AI Vision & Scene Describer
                {config.vlm && <span style={{ fontSize: '0.8rem', color: 'var(--color-secondary)' }}><Sparkles size={14} /> VLM</span>}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                {config.vlm
                    ? 'Powered by a vision-language model — you get contextual, spatial descriptions.'
                    : 'Running local object detection with spatial cues. Add a GEMINI_API_KEY on the backend for rich VLM descriptions.'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem' }}>
                <div className="card" style={{ padding: 0, overflow: 'hidden', background: '#000', borderRadius: '20px', position: 'relative', aspectRatio: '16/9' }}>
                    <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    {isLoading && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
                            <RefreshCw size={48} className="animate-spin" />
                            <p>Analyzing scene...</p>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <button onClick={handleDescribe} className="btn btn-primary" style={{ height: '70px', fontSize: '1.1rem', justifyContent: 'center' }} disabled={isLoading}>
                        <Camera size={26} /> Describe What I See
                    </button>

                    <button onClick={() => setLive((v) => !v)} className={`btn ${live ? 'btn-primary' : 'btn-secondary'}`} style={{ justifyContent: 'center' }}>
                        <RefreshCw size={20} /> {live ? 'Live Mode: ON' : 'Live Mode: OFF'}
                    </button>

                    <button onClick={() => setObstacleWatch((v) => !v)} className={`btn ${obstacleWatch ? 'btn-primary' : 'btn-secondary'}`} style={{ justifyContent: 'center' }} title={config.depth ? '' : 'Depth model loads on first use (large download)'}>
                        <Radar size={20} /> {obstacleWatch ? 'Obstacle Watch: ON' : 'Obstacle Watch: OFF'}
                    </button>

                    <div className="card" style={{ flex: 1, marginBottom: 0 }}>
                        <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                            Description {source && <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>({source})</span>}
                        </h4>
                        <p style={{ fontSize: '1.1rem', lineHeight: 1.6, padding: '1rem', background: 'rgba(0,0,0,0.25)', borderRadius: '12px' }}>
                            {description || 'Press "Describe What I See" to analyze the scene.'}
                        </p>
                        {description && (
                            <button onClick={() => speak(description)} className="btn btn-secondary" style={{ marginTop: '0.75rem', width: '100%' }}>
                                <Volume2 size={18} /> Read Again
                            </button>
                        )}
                        {objects.length > 0 && (
                            <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {objects.map((o, i) => (
                                    <span key={i} style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '10px', background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>
                                        {o.label} · {o.position}
                                    </span>
                                ))}
                            </div>
                        )}
                        {obstacle && (
                            <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: obstacle.proximity > 0.72 ? '#f43f5e' : 'var(--text-secondary)' }}>
                                {obstacle.msg || `Nearest obstacle: ${obstacle.direction} (${Math.round((obstacle.proximity || 0) * 100)}% proximity)`}
                            </div>
                        )}
                    </div>

                    {error && <div style={{ padding: '1rem', background: 'rgba(244,63,94,0.12)', color: '#fda4af', borderRadius: '12px' }}>{error}</div>}
                </div>
            </div>
        </div>
    );
};

export default SceneDescriber;
