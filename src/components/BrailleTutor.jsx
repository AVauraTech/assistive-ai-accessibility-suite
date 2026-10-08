import React, { useState } from 'react';
import { GraduationCap, ArrowRight, CheckCircle, Volume2 } from 'lucide-react';

const BrailleTutor = () => {
    const [currentStep, setCurrentStep] = useState(0);

    const lessons = [
        { char: 'A', braille: '⠁', desc: 'The first letter of the alphabet. Just the top-left dot.', dots: [1] },
        { char: 'B', braille: '⠃', desc: 'Dots 1 and 2 (the two dots on the left side).', dots: [1, 2] },
        { char: 'C', braille: '⠉', desc: 'Dots 1 and 4 (the two top dots).', dots: [1, 4] },
        { char: 'D', braille: '⠙', desc: 'Dots 1, 4, and 5.', dots: [1, 4, 5] },
        { char: 'E', braille: '⠑', desc: 'Dots 1 and 5.', dots: [1, 5] },
    ];

    const currentLesson = lessons[currentStep];

    const speak = (text) => {
        const u = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(u);
    };

    return (
        <div className="container animate-fade-in">
            <h2 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <GraduationCap size={32} color="#fbbf24" />
                Interactive Braille Learning
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '2rem' }}>
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '5rem', color: 'var(--color-primary)', marginBottom: '1rem' }}>
                        {currentLesson.char}
                    </div>
                    <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>{currentLesson.desc}</p>

                    <button onClick={() => speak(`Lesson ${currentLesson.char}. ${currentLesson.desc}`)} className="btn btn-secondary" style={{ width: '100%', marginBottom: '1rem' }}>
                        <Volume2 /> Hear Instructions
                    </button>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                        <button
                            disabled={currentStep === 0}
                            onClick={() => setCurrentStep(s => s - 1)}
                            className="btn btn-secondary"
                        >
                            Previous
                        </button>
                        <button
                            disabled={currentStep === lessons.length - 1}
                            onClick={() => setCurrentStep(s => s + 1)}
                            className="btn btn-primary"
                        >
                            Next Lesson <ArrowRight size={20} />
                        </button>
                    </div>
                </div>

                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{
                        fontSize: '12rem',
                        lineHeight: 1,
                        color: '#fff',
                        textShadow: '0 0 30px rgba(139, 92, 246, 0.5)',
                        background: 'rgba(255,255,255,0.05)',
                        padding: '2rem 4rem',
                        borderRadius: '30px',
                        border: '1px solid var(--glass-border)'
                    }}>
                        {currentLesson.braille}
                    </div>
                    <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(2, 40px)', gap: '20px' }}>
                        {[1, 4, 2, 5, 3, 6].map(dot => (
                            <div key={dot} style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                border: '2px solid var(--glass-border)',
                                background: currentLesson.dots.includes(dot) ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
                                boxShadow: currentLesson.dots.includes(dot) ? '0 0 20px rgba(139, 92, 246, 0.5)' : 'none'
                            }}></div>
                        ))}
                    </div>
                    <p style={{ marginTop: '2rem', color: 'var(--text-secondary)' }}>
                        Focus on the pattern. This is how <strong>{currentLesson.char}</strong> is represented in Braille.
                    </p>
                </div>
            </div>

            <div className="card" style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(16, 185, 129, 0.1)' }}>
                <CheckCircle color="#10b981" />
                <p><strong>Practice Challenge:</strong> Go to the <strong>Air Writing</strong> page and try to draw this pattern. Use "Translate to Text" to see if you mastered it!</p>
            </div>
        </div>
    );
};

export default BrailleTutor;
