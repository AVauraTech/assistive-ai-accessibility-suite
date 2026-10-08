import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
    Eye, Type, PenTool, Home, BookOpen,
    Mic, MousePointer, GraduationCap, Map, Hand, Scan
} from 'lucide-react';
import Reader from './components/Reader';
import Braille from './components/Braille';
import AirCanvas from './components/AirCanvas';
import SceneDescriber from './components/SceneDescriber';
import VoiceController from './components/VoiceController';
import Captions from './components/Captions';
import BrailleTutor from './components/BrailleTutor';
import GazeControl from './components/GazeControl';
import ASL from './components/ASL';

function Nav() {
    const location = useLocation();
    const isActive = (path) => location.pathname === path ? 'active' : '';

    return (
        <nav className="nav">
            <Link to="/" className="nav-logo">
                <div style={{
                    background: 'linear-gradient(45deg, var(--color-primary), var(--color-secondary))',
                    padding: '8px',
                    borderRadius: '12px',
                    display: 'flex'
                }}>
                    <Eye size={28} color="white" />
                </div>
                <span>AccessSuite AI</span>
            </Link>
            <div className="nav-links">
                <Link to="/" className={`nav-link ${isActive('/')}`}>Dashboard</Link>
                <Link to="/reader" className={`nav-link ${isActive('/reader')}`}>Reader</Link>
                <Link to="/air-write" className={`nav-link ${isActive('/air-write')}`}>Air Write</Link>
                <Link to="/scene-describer" className={`nav-link ${isActive('/scene-describer')}`}>AI Vision</Link>
                <Link to="/gaze" className={`nav-link ${isActive('/gaze')}`}>Gaze</Link>
                <Link to="/asl" className={`nav-link ${isActive('/asl')}`}>ASL</Link>
                <Link to="/braille" className={`nav-link ${isActive('/braille')}`}>Braille</Link>
            </div>
        </nav>
    );
}

function Dashboard() {
    return (
        <div className="container animate-fade-in">
            <header style={{ marginBottom: '4rem', textAlign: 'center' }}>
                <h1 style={{ fontSize: '4rem', marginBottom: '1rem', background: 'linear-gradient(to right, #fff, var(--color-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Your Inclusive World.
                </h1>
                <p style={{ fontSize: '1.5rem', color: 'var(--text-secondary)', maxWidth: '800px', margin: '0 auto' }}>
                    Empowering every user with AI-driven vision, motion, and speech tools.
                </p>
            </header>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '2.5rem'
            }}>
                <DashboardCard
                    to="/reader"
                    icon={<BookOpen size={48} />}
                    title="Document Reader"
                    desc="Listen, summarize, and annotate any document with AI support."
                    color="var(--color-secondary)"
                />

                <DashboardCard
                    to="/air-write"
                    icon={<PenTool size={48} />}
                    title="Air Writing"
                    desc="Write in the air using gestures and convert hand-drawn text to speech."
                    color="var(--color-accent)"
                />

                <DashboardCard
                    to="/scene-describer"
                    icon={<Eye size={48} />}
                    title="AI Vision"
                    desc="Hear a detailed description of your surroundings and identify objects."
                    color="var(--color-primary)"
                />

                <DashboardCard
                    to="/braille"
                    icon={<Type size={48} />}
                    title="Braille Studio"
                    desc="Convert text to visual Braille and learn the language in real-time."
                    color="#f43f5e"
                />

                <DashboardCard
                    to="/captions"
                    icon={<Mic size={48} />}
                    title="Live Captions"
                    desc="Turn ambient speech into real-time text for accessibility."
                    color="#10b981"
                />

                <DashboardCard
                    to="/braille-tutor"
                    icon={<GraduationCap size={48} />}
                    title="Braille Tutor"
                    desc="Practice Braille with interactive air-writing feedback."
                    color="#fbbf24"
                />

                <DashboardCard
                    to="/gaze"
                    icon={<Scan size={48} />}
                    title="Gaze Control"
                    desc="Navigate hands-free with eye-gaze, blinks, and head movements."
                    color="#06b6d4"
                />

                <DashboardCard
                    to="/asl"
                    icon={<Hand size={48} />}
                    title="ASL Fingerspelling"
                    desc="Two-way sign-to-voice and text-to-sign fingerspelling."
                    color="#f43f5e"
                />
            </div>

            <div className="card" style={{ marginTop: '4rem', textAlign: 'center', background: 'linear-gradient(rgba(139, 92, 246, 0.1), transparent)' }}>
                <h2>Ready for Hands-Free?</h2>
                <p>Try saying <strong>"Open Reader"</strong> or <strong>"Go to Vision"</strong> to navigate without a mouse.</p>
            </div>
        </div>
    );
}

function DashboardCard({ to, icon, title, desc, color }) {
    return (
        <Link to={to} style={{ textDecoration: 'none' }}>
            <button className="btn btn-large" style={{ position: 'relative', overflow: 'hidden' }}>
                <div style={{
                    position: 'absolute',
                    top: '-20px',
                    right: '-20px',
                    width: '100px',
                    height: '100px',
                    background: color,
                    opacity: 0.1,
                    borderRadius: '50%'
                }}></div>
                <div style={{ color: color, marginBottom: '1.5rem' }}>{icon}</div>
                <h3 style={{ fontSize: '1.8rem', marginBottom: '0.8rem' }}>{title}</h3>
                <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{desc}</p>
            </button>
        </Link>
    );
}

function App() {
    return (
        <Router>
            <Nav />
            <VoiceController />
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/reader" element={<Reader />} />
                <Route path="/braille" element={<Braille />} />
                <Route path="/air-write" element={<AirCanvas />} />
                <Route path="/scene-describer" element={<SceneDescriber />} />
                {/* Placeholders for new components */}
                <Route path="/captions" element={<Captions />} />
                <Route path="/braille-tutor" element={<BrailleTutor />} />
                <Route path="/gaze" element={<GazeControl />} />
                <Route path="/asl" element={<ASL />} />
            </Routes>
        </Router>
    );
}

export default App;
