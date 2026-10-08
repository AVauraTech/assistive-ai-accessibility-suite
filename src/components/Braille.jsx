import React, { useState, useEffect, useRef } from 'react';
import { Copy, Usb, Send, Trash2 } from 'lucide-react';
import { toBraille, toCells } from '../lib/braille';
import { buzz } from '../lib/api';

const Braille = () => {
    const [input, setInput] = useState('');
    const [serialSupported] = useState('serial' in navigator);
    const [port, setPort] = useState(null);
    const [writer, setWriter] = useState(null);
    const [serialMsg, setSerialMsg] = useState(null);
    const writerRef = useRef(null);

    useEffect(() => {
        const pendingText = localStorage.getItem('pendingBrailleText');
        if (pendingText) {
            setInput(pendingText);
            localStorage.removeItem('pendingBrailleText');
        }
        return () => {
            if (writerRef.current) writerRef.current.releaseLock?.();
        };
    }, []);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(toBraille(input));
        buzz(12);
        alert('Copied Braille to clipboard!');
    };

    // --- Web Serial: connect to a refreshable braille display ---
    const connectSerial = async () => {
        try {
            const selected = await navigator.serial.requestPort();
            await selected.open({ baudRate: 115200 });
            const w = selected.writable.getWriter();
            writerRef.current = w;
            setWriter(w);
            setPort(selected);
            setSerialMsg({ type: 'ok', text: 'Connected to braille display.' });
            buzz([15, 40, 15]);
        } catch (e) {
            setSerialMsg({ type: 'err', text: 'Serial error: ' + e.message });
        }
    };

    const disconnectSerial = async () => {
        try {
            if (writerRef.current) {
                writerRef.current.releaseLock();
                writerRef.current = null;
            }
            if (port) await port.close();
        } catch {
            /* ignore */
        }
        setPort(null);
        setWriter(null);
        setSerialMsg(null);
    };

    // Send cell bitmasks to the display. Protocol is display-specific; we emit a
    // simple framing: [0xFF][len][cells...][0x00]. Adapt the frame to your device.
    const sendToDisplay = async () => {
        if (!writerRef.current) {
            setSerialMsg({ type: 'err', text: 'No display connected.' });
            return;
        }
        const cells = toCells(input);
        const frame = new Uint8Array([0xff, cells.length & 0xff, ...cells, 0x00]);
        try {
            await writerRef.current.write(frame);
            buzz([10, 30, 10]);
            setSerialMsg({ type: 'ok', text: `Sent ${cells.length} cells to display.` });
        } catch (e) {
            setSerialMsg({ type: 'err', text: 'Write failed: ' + e.message });
        }
    };

    return (
        <div className="container">
            <h2 style={{ marginBottom: '1.5rem' }}>Braille Studio</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="card">
                    <h3 style={{ marginBottom: '1rem' }}>Input Text</h3>
                    <textarea
                        style={{ width: '100%', height: '300px', padding: '1rem', fontSize: '1.2rem', borderRadius: '8px', border: '1px solid var(--glass-border)', resize: 'none', background: 'rgba(0,0,0,0.25)', color: '#fff' }}
                        placeholder="Type here to convert..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    />
                </div>

                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3>Braille Output</h3>
                        <button onClick={copyToClipboard} className="btn btn-secondary" title="Copy">
                            <Copy size={18} /> Copy
                        </button>
                    </div>
                    <div style={{ width: '100%', height: '300px', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '2rem', overflowY: 'auto', letterSpacing: '0.1em', fontFamily: 'Segoe UI Symbol, sans-serif' }}>
                        {toBraille(input)}
                    </div>
                </div>
            </div>

            {/* Refreshable hardware display */}
            <div className="card" style={{ marginTop: '0.5rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                    <Usb size={22} /> Refreshable Braille Display
                </h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.95rem' }}>
                    {serialSupported
                        ? 'Connect a USB/Bluetooth braille display via the Web Serial API and push text to the physical cells.'
                        : 'Your browser does not support the Web Serial API. Use Chrome/Edge over HTTPS or localhost.'}
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {!port ? (
                        <button className="btn btn-primary" onClick={connectSerial} disabled={!serialSupported}>
                            <Usb size={18} /> Connect Display
                        </button>
                    ) : (
                        <>
                            <button className="btn btn-primary" onClick={sendToDisplay} disabled={!input}>
                                <Send size={18} /> Send to Display
                            </button>
                            <button className="btn btn-secondary" onClick={disconnectSerial}>
                                <Trash2 size={18} /> Disconnect
                            </button>
                        </>
                    )}
                </div>
                {serialMsg && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: 10, background: serialMsg.type === 'ok' ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)', color: serialMsg.type === 'ok' ? '#10b981' : '#fda4af' }}>
                        {serialMsg.text}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Braille;
