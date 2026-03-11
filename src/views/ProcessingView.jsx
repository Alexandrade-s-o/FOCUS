import React, { useEffect, useState } from 'react';
import { useAppContext } from '../AppContext';
import { mockProcessRecording } from '../aiService';
import { Sparkles, Loader, AlertCircle } from 'lucide-react';

const ProcessingView = () => {
    const { addProject, navigateTo, currentAudioBlob } = useAppContext();
    const [errorStatus, setErrorStatus] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const processAudio = async () => {
            try {
                if (!currentAudioBlob) {
                    throw new Error("No hay un archivo de audio válido.");
                }

                // Use real fetch to Express server
                const newProject = await mockProcessRecording(currentAudioBlob);

                if (isMounted) {
                    addProject(newProject);
                    navigateTo('project', newProject.id);
                }
            } catch (err) {
                if (isMounted) {
                    setErrorStatus(err.message || "Error desconocido");
                }
            }
        };

        processAudio();
        return () => { isMounted = false; };
    }, [addProject, navigateTo, currentAudioBlob]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '24px',
            textAlign: 'center'
        }}>

            {errorStatus ? (
                <div style={{ textAlign: 'center', color: '#ff4f4f', maxWidth: '300px' }}>
                    <AlertCircle size={48} style={{ margin: '0 auto 16px' }} />
                    <p>Lo sentimos, no pudimos procesar la grabación.</p>
                    <p style={{ fontSize: '12px', marginTop: '8px', opacity: 0.8 }}>{errorStatus}</p>
                    <button onClick={() => navigateTo('dashboard')} style={{ marginTop: '24px', padding: '12px 24px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '8px', color: '#fff' }}>Volver</button>
                </div>
            ) : (
                <>
                    <div style={{
                        position: 'relative',
                        width: '120px', height: '120px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '32px'
                    }}>
                        {/* Simple rotating loader */}
                        <Loader
                            size={64}
                            color="var(--accent-cyan)"
                            style={{ animation: 'spin 2s linear infinite' }}
                        />

                        {/* Floating sparkles animation */}
                        <div style={{ position: 'absolute', top: '10px', right: '10px', animation: 'float 3s ease-in-out infinite' }}>
                            <Sparkles size={24} color="#fff" />
                        </div>
                    </div>

                    <h2 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '12px' }}>
                        La IA está procesando...
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '280px', lineHeight: '1.6' }}>
                        Enviando el audio a Gemini de manera segura y generando el checklist.
                    </p>

                    <style>{`
                @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
                }
            `}</style>
                </>
            )}
        </div>
    );
};

export default ProcessingView;
