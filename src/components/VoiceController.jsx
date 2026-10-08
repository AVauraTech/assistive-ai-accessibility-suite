import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mic, MicOff } from 'lucide-react';

const VoiceController = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error('Speech Recognition not supported in this browser.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const current = event.resultIndex;
            const text = event.results[current][0].transcript.toLowerCase();
            setTranscript(text);

            if (event.results[current].isFinal) {
                console.log('Final Transcript:', text);
                handleCommand(text);
            }
        };

        recognition.onerror = (err) => {
            console.error('Recognition Error:', err);
            setIsListening(false);
        };

        const handleCommand = (cmd) => {
            if (cmd.includes('home') || cmd.includes('dashboard')) navigate('/');
            if (cmd.includes('reader') || cmd.includes('read')) navigate('/reader');
            if (cmd.includes('writing') || cmd.includes('canvas') || cmd.includes('air write')) navigate('/air-write');
            if (cmd.includes('braille tutor') || cmd.includes('tutor') || cmd.includes('learn')) navigate('/braille-tutor');
            if (cmd.includes('braille')) navigate('/braille');
            if (cmd.includes('scene') || cmd.includes('vision')) navigate('/scene-describer');
            if (cmd.includes('gaze') || cmd.includes('eye') || cmd.includes('eyes')) navigate('/gaze');
            if (cmd.includes('sign') || cmd.includes('asl') || cmd.includes('sign language')) navigate('/asl');
            if (cmd.includes('caption') || cmd.includes('transcribe')) navigate('/captions');
        };

        if (isListening) {
            recognition.start();
        } else {
            recognition.stop();
        }

        return () => recognition.stop();
    }, [isListening, navigate]);

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--card-bg)',
            padding: '10px 20px',
            borderRadius: '30px',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-color)',
            backdropFilter: 'blur(10px)'
        }}>
            <button
                onClick={() => setIsListening(!isListening)}
                className={`btn ${isListening ? 'btn-danger' : 'btn-primary'}`}
                style={{ borderRadius: '50%', width: '50px', height: '50px', padding: 0, justifyContent: 'center' }}
                title={isListening ? "Stop Voice Commands" : "Start Voice Commands"}
            >
                {isListening ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {isListening ? (transcript || "Listening for commands...") : "Voice Off (Click to activate)"}
            </div>
        </div>
    );
};

export default VoiceController;
