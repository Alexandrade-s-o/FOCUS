import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../AppContext';
import { Mic, Square, AlertCircle } from 'lucide-react';

const RecordView = () => {
    const { navigateTo, setCurrentAudioBlob } = useAppContext();
    const [seconds, setSeconds] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [errorStatus, setErrorStatus] = useState(null);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    useEffect(() => {
        let interval;
        if (isRecording) {
            interval = setInterval(() => setSeconds(s => s + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    useEffect(() => {
        // Start microphone when component mounts
        const initMic = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                // Use webm if supported, usually standard for Chrome/Firefox
                const options = { mimeType: 'audio/webm' };

                const mediaRecorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(options.mimeType) ? options : {});
                mediaRecorderRef.current = mediaRecorder;

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        audioChunksRef.current.push(e.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    const mimeType = mediaRecorder.mimeType || 'audio/webm';
                    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                    setCurrentAudioBlob(audioBlob);
                    // Stop all audio tracks to release the mic light
                    stream.getTracks().forEach(track => track.stop());
                    navigateTo('processing');
                };

                // Start recording right away
                mediaRecorder.start();
                setIsRecording(true);

            } catch (err) {
                console.error("Microphone access denied or error:", err);
                setErrorStatus("No se pudo acceder al micrófono. Por favor permite el acceso en tu navegador.");
            }
        };

        initMic();

        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        };
    }, [navigateTo, setCurrentAudioBlob]);

    const formatTime = (totalSeconds) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop(); // triggers onstop
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        navigateTo('dashboard');
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '24px'
        }}>

            {errorStatus ? (
                <div style={{ textAlign: 'center', color: '#ff4f4f', maxWidth: '300px' }}>
                    <AlertCircle size={48} style={{ margin: '0 auto 16px' }} />
                    <p>{errorStatus}</p>
                    <button onClick={cancelRecording} style={{ marginTop: '24px', padding: '12px 24px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '8px', color: '#fff' }}>Volver</button>
                </div>
            ) : (
                <>
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%'
                    }}>
                        {/* Pulsing Mic visualizer */}
                        <div style={{ position: 'relative', width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div className="animate-pulse-ring" style={{
                                position: 'absolute',
                                width: '100%', height: '100%',
                                borderRadius: '50%',
                                backgroundColor: 'var(--accent-cyan-muted)',
                                border: '1px solid var(--accent-cyan)'
                            }} />
                            <div style={{
                                width: '80px', height: '80px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--bg-surface-elevated)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                zIndex: 2,
                                boxShadow: '0 0 30px rgba(0, 229, 255, 0.2)'
                            }}>
                                <Mic size={40} color="var(--accent-cyan)" />
                            </div>
                        </div>

                        <h2 style={{ fontSize: '32px', fontWeight: '300', marginTop: '40px', fontFamily: 'monospace' }}>
                            {formatTime(seconds)}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Escuchando instrucciones...</p>
                    </div>

                    {/* Controls */}
                    <div style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-around',
                        alignItems: 'center',
                        paddingBottom: '32px'
                    }}>
                        <button
                            onClick={cancelRecording}
                            style={{
                                color: 'var(--text-secondary)',
                                padding: '12px 24px',
                                fontSize: '14px'
                            }}>
                            Cancelar
                        </button>

                        <button
                            onClick={stopRecording}
                            style={{
                                backgroundColor: '#ff3b3b',
                                width: '64px', height: '64px',
                                borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 0 20px rgba(255, 59, 59, 0.3)'
                            }}>
                            <Square size={24} color="#fff" fill="#fff" />
                        </button>

                        <div style={{ width: '80px' }}></div>
                    </div>
                </>
            )}
        </div>
    );
};

export default RecordView;
