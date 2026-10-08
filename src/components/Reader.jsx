import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Type, StickyNote, Play, Pause, FileText, Upload, RefreshCw, Sparkles, Accessibility } from 'lucide-react';
import { fetchConfig, postJSON } from '../lib/api';

const Reader = () => {
    const [text, setText] = useState('Welcome to the Accessibility Document Reader. Upload a file or paste text here to begin reading. \n\nThis tool supports Text-to-Speech, font adjustments, and integrated note-taking.');
    const [isPlaying, setIsPlaying] = useState(false);
    const [fontSize, setFontSize] = useState(18);
    const [highContrast, setHighContrast] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [notes, setNotes] = useState('');
    const [utterance, setUtterance] = useState(null);
    const [dyslexiaFont, setDyslexiaFont] = useState(false);
    const [readingLevel, setReadingLevel] = useState('5th grade');
    const [isSimplifying, setIsSimplifying] = useState(false);
    const [config, setConfig] = useState({ simplify: false });

    useEffect(() => {
        fetchConfig().then(setConfig);
    }, []);

    useEffect(() => {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1;
        u.pitch = 1;
        u.onend = () => setIsPlaying(false);
        setUtterance(u);

        return () => {
            window.speechSynthesis.cancel();
        };
    }, [text]);

    const handlePlay = () => {
        if (!utterance) return;
        window.speechSynthesis.cancel();
        utterance.text = text; // Update text
        window.speechSynthesis.speak(utterance);
        setIsPlaying(true);
    };

    const handleStop = () => {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.type === "text/plain") {
                const reader = new FileReader();
                reader.onload = (e) => setText(e.target.result);
                reader.readAsText(file);
            } else {
                alert("For this prototype, please convert PDFs to .txt. Full PDF rendering coming in v2!");
                // Simulate PDF text
                setText("PDF Content Loaded: [Simulated Content] \n\nThe study of accessibility involves making web content available to all users...");
            }
        }
    };

    const [isSummarizing, setIsSummarizing] = useState(false);

    const summarize = async () => {
        setIsSummarizing(true);
        try {
            const response = await fetch('http://127.0.0.1:8000/api/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await response.json();
            if (data.summary) {
                setNotes(prev => prev + "\n--- AI Summary ---\n" + data.summary + "\n");
                setShowNotes(true);
                alert("Summary generated and added to your notes!");
            }
        } catch (err) {
            console.error("Summarization failed:", err);
            alert("Summarization failed. Please check if the backend is running.");
        } finally {
            setIsSummarizing(false);
        }
    };

    const simplify = async () => {
        setIsSimplifying(true);
        try {
            const data = await postJSON('/api/simplify', { text, reading_level: readingLevel });
            if (data.simplified) {
                setNotes(prev => prev + "\n--- Plain-Language Rewrite ---\n" + data.simplified + "\n");
                setShowNotes(true);
                alert("Simplified version added to your notes!");
            } else {
                alert(data.error || "Simplification unavailable. Set GEMINI_API_KEY on the backend.");
            }
        } catch (err) {
            alert("Simplification failed: " + err.message);
        } finally {
            setIsSimplifying(false);
        }
    };

    return (
        <div className={`container ${highContrast ? 'high-contrast' : ''}`} style={{
            filter: highContrast ? 'invert(1) hue-rotate(180deg)' : 'none',
            transition: 'filter 0.3s ease'
        }}>
            <div className="card" style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <label className="btn btn-primary">
                    <Upload size={20} /> Upload File
                    <input type="file" hidden onChange={handleFileUpload} accept=".txt,.pdf" />
                </label>

                <div style={{ width: '1px', height: '30px', background: '#ddd' }}></div>

                <button onClick={isPlaying ? handleStop : handlePlay} className="btn" style={{ background: isPlaying ? '#ffc9c9' : '#d3f9d8' }}>
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    {isPlaying ? 'Stop Reading' : 'Read Aloud'}
                </button>

                <button onClick={summarize} className="btn" style={{ background: '#e7f5ff' }} disabled={isSummarizing}>
                    {isSummarizing ? <RefreshCw size={20} className="animate-spin" /> : <FileText size={20} />}
                    {isSummarizing ? 'Summarizing...' : 'Understand / Summarize'}
                </button>

                <button onClick={simplify} className="btn" style={{ background: config.simplify ? '#f3e8ff' : '#e9ecef' }} disabled={isSimplifying}
                    title={config.simplify ? 'Rewrite in plain language (GenAI)' : 'Requires GEMINI_API_KEY on backend'}>
                    {isSimplifying ? <RefreshCw size={20} className="animate-spin" /> : <Sparkles size={20} />}
                    {isSimplifying ? 'Simplifying...' : 'Simplify Text'}
                </button>

                <select value={readingLevel} onChange={(e) => setReadingLevel(e.target.value)}
                    className="btn" style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)' }}
                    title="Target reading level for Simplify">
                    <option value="3rd grade">Grade 3</option>
                    <option value="5th grade">Grade 5</option>
                    <option value="8th grade">Grade 8</option>
                </select>

                <button onClick={() => setDyslexiaFont(!dyslexiaFont)} className={`btn ${dyslexiaFont ? 'btn-primary' : ''}`} title="Toggle dyslexia-friendly font">
                    <Accessibility size={20} /> Dyslexia Font
                </button>

                <div style={{ flex: 1 }}></div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Type size={16} />
                    <input
                        type="range"
                        min="12"
                        max="40"
                        value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        style={{ width: '100px' }}
                    />
                </div>

                <button onClick={() => setHighContrast(!highContrast)} className="btn" title="Toggle High Contrast">
                    {highContrast ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    {/* Using Volume icon as placeholder for contrast, should be Eye */}
                    Contrast
                </button>

                <button onClick={() => setShowNotes(!showNotes)} className={`btn ${showNotes ? 'btn-primary' : ''}`}>
                    <StickyNote size={20} /> Notes
                </button>
            </div>

            <div style={{ display: 'flex', gap: '2rem' }}>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    style={{
                        flex: 1,
                        minHeight: '60vh',
                        padding: '2rem',
                        fontSize: `${fontSize}px`,
                        lineHeight: 1.6,
                        borderRadius: '12px',
                        border: '2px solid #eee',
                        resize: 'vertical',
                        fontFamily: dyslexiaFont ? "'OpenDyslexic', 'Comic Sans MS', sans-serif" : 'Georgia, serif',
                        letterSpacing: dyslexiaFont ? '0.04em' : 'normal',
                        wordSpacing: dyslexiaFont ? '0.15em' : 'normal'
                    }}
                />

                {showNotes && (
                    <div style={{ width: '300px', flexShrink: 0 }}>
                        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <h3>My Notes</h3>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Take notes here..."
                                style={{
                                    flex: 1,
                                    width: '100%',
                                    marginTop: '1rem',
                                    padding: '1rem',
                                    borderRadius: '8px',
                                    border: '1px solid #ddd',
                                    resize: 'none'
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reader;
