import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../AppContext';
import { FileText, CheckSquare, MessageSquare, Send, Trash2 } from 'lucide-react';
import { mockAiChatResponse } from '../aiService';

const ProjectDetailView = () => {
    const { projects, activeProjectId, toggleTaskCompletion, deleteProject, navigateTo } = useAppContext();
    const project = projects.find(p => p.id === activeProjectId);

    const [activeTab, setActiveTab] = useState('summary'); // summary, checklist, chat
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages, isTyping, activeTab]);

    if (!project) return null;

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const userMsg = {
            id: Date.now().toString() + '-user',
            sender: 'user',
            text: chatInput,
            timestamp: new Date().toISOString()
        };

        setChatMessages(prev => [...prev, userMsg]);
        setChatInput('');
        setIsTyping(true);

        const aiResponse = await mockAiChatResponse(userMsg.text, project);

        setIsTyping(false);
        setChatMessages(prev => [...prev, aiResponse]);
    };

    const completedCount = project.checklist.filter(t => t.completed).length;
    const totalCount = project.checklist.length;
    const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* Project Header */}
            <div style={{ padding: '24px 20px', paddingBottom: '0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '22px', fontWeight: '600' }}>{project.title}</h2>
                    <button
                        onClick={() => {
                            if (window.confirm("¿Eliminar este proyecto?")) {
                                deleteProject(project.id);
                            }
                        }}
                        style={{ color: 'var(--text-secondary)', padding: '4px' }}
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '24px' }}>
                    Grabado el {new Date(project.timestamp).toLocaleString()}
                </p>

                {/* Tab Navigation */}
                <div style={{
                    display: 'flex',
                    borderBottom: '1px solid var(--border-color)',
                    marginBottom: '20px'
                }}>
                    {[
                        { id: 'summary', label: 'Resumen', icon: FileText },
                        { id: 'checklist', label: 'Tareas', icon: CheckSquare },
                        { id: 'chat', label: 'Chat IA', icon: MessageSquare }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                flex: 1,
                                padding: '12px 0',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '6px',
                                color: activeTab === tab.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                borderBottom: activeTab === tab.id ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                                transition: 'all var(--transition-fast)'
                            }}
                        >
                            <tab.icon size={18} />
                            <span style={{ fontSize: '13px', fontWeight: '500' }}>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px 20px' }}>

                {/* SUMMARY TAB */}
                {activeTab === 'summary' && (
                    <div className="fade-in">
                        <h3 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '12px', color: 'var(--text-secondary)' }}>Resumen General</h3>
                        <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '24px', lineHeight: '1.6' }}>
                            {project.summary}
                        </div>

                        <h3 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '12px', color: 'var(--text-secondary)' }}>Instrucciones Clave</h3>
                        <ul style={{ listStylePosition: 'inside', color: 'var(--text-primary)', lineHeight: '1.8' }}>
                            {project.keyInstructions.map((inst, i) => (
                                <li key={i} style={{ marginBottom: '8px' }}>{inst}</li>
                            ))}
                        </ul>

                        <div style={{ marginTop: '32px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '12px', color: 'var(--text-secondary)' }}>Transcripción Original</h3>
                            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', fontStyle: 'italic', lineHeight: '1.6', background: 'var(--bg-surface-elevated)', padding: '12px', borderRadius: '8px' }}>
                                "{project.transcript}"
                            </p>
                        </div>
                    </div>
                )}

                {/* CHECKLIST TAB */}
                {activeTab === 'checklist' && (
                    <div className="fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Progreso</p>
                            <p style={{ color: 'var(--accent-cyan)', fontWeight: '600', fontSize: '14px' }}>{progressPercent}%</p>
                        </div>

                        {/* Progress Bar Background */}
                        <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '3px', marginBottom: '24px', overflow: 'hidden' }}>
                            {/* Progress Bar Fill */}
                            <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: 'var(--accent-cyan)', transition: 'width 0.4s ease' }} />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {project.checklist.map(task => (
                                <div key={task.id}
                                    className="glass-panel"
                                    onClick={() => toggleTaskCompletion(project.id, task.id)}
                                    style={{
                                        padding: '16px',
                                        borderRadius: 'var(--radius-md)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        opacity: task.completed ? 0.6 : 1,
                                        borderLeft: task.completed ? '4px solid var(--accent-cyan)' : '1px solid transparent'
                                    }}>
                                    <div style={{
                                        width: '24px', height: '24px',
                                        borderRadius: '50%',
                                        border: `2px solid ${task.completed ? 'var(--accent-cyan)' : 'var(--text-tertiary)'}`,
                                        backgroundColor: task.completed ? 'var(--accent-cyan)' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        marginRight: '16px',
                                        transition: 'all 0.2s ease'
                                    }}>
                                        {task.completed && <CheckSquare size={14} color="#000" fill="#000" />}
                                    </div>
                                    <span style={{
                                        fontSize: '15px',
                                        textDecoration: task.completed ? 'line-through' : 'none',
                                        color: task.completed ? 'var(--text-secondary)' : 'var(--text-primary)'
                                    }}>
                                        {task.text}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* CHAT TAB */}
                {activeTab === 'chat' && (
                    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {chatMessages.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: '40px' }}>
                                <MessageSquare size={48} style={{ opacity: 0.2, margin: '0 auto 16px', display: 'block' }} />
                                <p>¡Pregúntame cualquier cosa sobre las instrucciones!</p>
                                <p style={{ fontSize: '13px', marginTop: '8px' }}>"¿De qué color debería ser?"</p>
                                <p style={{ fontSize: '13px' }}>"¿Qué va primero?"</p>
                            </div>
                        )}

                        <div style={{ flex: 1, paddingBottom: '80px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {chatMessages.map(msg => (
                                <div key={msg.id} style={{
                                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                                    backgroundColor: msg.sender === 'user' ? 'var(--accent-cyan)' : 'var(--bg-surface-elevated)',
                                    color: msg.sender === 'user' ? '#000' : 'var(--text-primary)',
                                    padding: '12px 16px',
                                    borderRadius: 'var(--radius-lg)',
                                    borderBottomRightRadius: msg.sender === 'user' ? '4px' : 'var(--radius-lg)',
                                    borderBottomLeftRadius: msg.sender === 'ai' ? '4px' : 'var(--radius-lg)',
                                    maxWidth: '85%',
                                    lineHeight: '1.5'
                                }}>
                                    {msg.text}
                                </div>
                            ))}

                            {isTyping && (
                                <div style={{
                                    alignSelf: 'flex-start',
                                    backgroundColor: 'var(--bg-surface-elevated)',
                                    padding: '12px 20px',
                                    borderRadius: 'var(--radius-lg)',
                                    borderBottomLeftRadius: '4px',
                                }}>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <div className="typing-dot" />
                                        <div className="typing-dot" style={{ animationDelay: '0.2s' }} />
                                        <div className="typing-dot" style={{ animationDelay: '0.4s' }} />
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Chat Input */}
                        <form onSubmit={handleSendMessage} style={{
                            position: 'absolute',
                            bottom: '20px', left: '20px', right: '20px',
                            display: 'flex',
                            gap: '12px'
                        }}>
                            <input
                                type="text"
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                placeholder="Pregunta sobre este proyecto..."
                                style={{
                                    flex: 1,
                                    backgroundColor: 'var(--bg-surface-elevated)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-full)',
                                    padding: '12px 20px',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px'
                                }}
                            />
                            <button type="submit" style={{
                                backgroundColor: chatInput.trim() ? 'var(--accent-cyan)' : 'var(--bg-surface-elevated)',
                                color: chatInput.trim() ? '#000' : 'var(--text-secondary)',
                                width: '44px', height: '44px',
                                borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all var(--transition-fast)'
                            }}>
                                <Send size={18} />
                            </button>
                        </form>
                    </div>
                )}

            </div>

            <style>{`
        .fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .typing-dot {
          width: 6px; height: 6px;
          background-color: var(--text-secondary);
          border-radius: 50%;
          animation: typingPulse 1.4s infinite ease-in-out both;
        }
        @keyframes typingPulse {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
        </div>
    );
};

export default ProjectDetailView;
