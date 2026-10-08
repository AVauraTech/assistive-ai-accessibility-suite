import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Type, Download, Trash2 } from 'lucide-react';

const Captions = () => {
    const [isListening, setIsListening] = useState(false);
    const [captions, setCaptions] = useState([]);
    const [fontSize, setFontSize] = useState(24);
    const scrollRef = useRef(null);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const results = Array.from(event.results)
                .map(result => result[0].transcript)
                .join('. ');

            // Just take the latest chunk for display
            const latest = event.results[event.results.length - 1][0].transcript;
            if (event.results[event.results.length - 1].isFinal) {
                setCaptions(prev => [...prev, latest]);
            }
        };

        if (isListening) {
            recognition.start();
        } else {
            recognition.stop();
        }

        return () => recognition.stop();
    }, [isListening]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [captions]);

    return (
        <div className="container animate-fade-in">
            <h2 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <Mic size={32} color="#10b981" />
                Live Transcription & Captions
            </h2>

            <div className="card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', position: 'sticky', top: '80px', zIndex: 10 }}>
                <button
                    onClick={() => setIsListening(!isListening)}
                    className={`btn ${isListening ? 'btn-danger' : 'btn-primary'}`}
                    style={{ background: isListening ? 'var(--color-accent)' : '#10b981' }}
                >
                    {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                    {isListening ? 'Stop Listening' : 'Start Captions'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
                    <Type size={20} />
                    <input
                        type="range"
                        min="16" max="60"
                        value={fontSize}
                        onChange={(e) => setFontSize(e.target.value)}
                    />
                </div>

                <button onClick={() => setCaptions([])} className="btn btn-secondary">
                    <Trash2 size={20} /> Clear
                </button>
            </div>

            <div
                ref={scrollRef}
                style={{
                    height: '60vh',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '20px',
                    padding: '3rem',
                    overflowY: 'auto',
                    fontSize: `${fontSize}px`,
                    lineHeight: '1.8',
                    fontWeight: '600',
                    color: '#fff',
                    border: '1px solid var(--glass-border)',
                    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
                }}
            >
                {captions.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '10%' }}>
                        <Mic size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                        <p>Waiting for speech input...</p>
                        <p style={{ fontSize: '1rem', fontWeight: 400 }}>Perfect for meetings, lectures, or conversations.</p>
                    </div>
                ) : (
                    captions.map((cap, i) => (
                        <p key={i} style={{ marginBottom: '1.5rem', animation: 'fadeIn 0.5s ease-out' }}>
                            {cap}
                        </p>
                    ))
                )}
            </div>
        </div>
    );
};

export default Captions;
