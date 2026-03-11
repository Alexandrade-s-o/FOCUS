import React from 'react';
import { useAppContext } from '../AppContext';
import { Mic, ListTodo, ChevronRight } from 'lucide-react';

const Dashboard = () => {
    const { projects, navigateTo } = useAppContext();

    // Calculate pending tasks from all projects
    const pendingTasks = projects.flatMap(p =>
        p.checklist.filter(t => !t.completed).map(t => ({ ...t, projectId: p.id, projectTitle: p.title }))
    ).slice(0, 3); // showing top 3

    return (
        <div style={{ padding: '24px 20px', position: 'relative', minHeight: '100%' }}>

            {/* Greeting Section */}
            <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '300', marginBottom: '8px' }}>
                    Buenas tardes, <span style={{ fontWeight: '600' }}>Creativo</span>.
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                    ¿Listo para capturar tu próxima idea brillante?
                </p>
            </section>

            {/* Pending Tasks Reminder */}
            {pendingTasks.length > 0 && (
                <section style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '8px' }}>
                        <ListTodo size={20} color="var(--accent-cyan)" />
                        <h3 style={{ fontSize: '16px', fontWeight: '500' }}>Tareas Pendientes</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {pendingTasks.map((task, idx) => (
                            <div key={idx} className="glass-panel" style={{
                                padding: '16px',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                alignItems: 'flex-start',
                                cursor: 'pointer'
                            }}
                                onClick={() => navigateTo('project', task.projectId)}>
                                <div style={{
                                    width: '20px', height: '20px',
                                    borderRadius: '50%', border: '2px solid var(--border-color)',
                                    marginRight: '12px', marginTop: '2px'
                                }} />
                                <div>
                                    <p style={{ fontSize: '14px', marginBottom: '4px' }}>{task.text}</p>
                                    <p style={{ fontSize: '12px', color: 'var(--accent-cyan)' }}>De: {task.projectTitle}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Recent Projects */}
            <section style={{ marginBottom: '100px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '16px' }}>Grabaciones Recientes</h3>

                {projects.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '40px 20px',
                        border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)',
                        color: 'var(--text-tertiary)'
                    }}>
                        <p>Aún no hay grabaciones. Toca el micrófono para empezar.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {projects.map(project => (
                            <div key={project.id}
                                onClick={() => navigateTo('project', project.id)}
                                className="glass-panel" style={{
                                    padding: '16px',
                                    borderRadius: 'var(--radius-md)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer'
                                }}>
                                <div>
                                    <h4 style={{ fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>{project.title}</h4>
                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {new Date(project.timestamp).toLocaleDateString()} • {project.checklist.length} tareas
                                    </p>
                                </div>
                                <ChevronRight size={20} color="var(--text-tertiary)" />
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Floating Action Button */}
            <div style={{
                position: 'fixed',
                bottom: '32px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 100
            }}>
                <button
                    onClick={() => navigateTo('record')}
                    style={{
                        backgroundColor: 'var(--accent-cyan)',
                        color: '#000',
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--glow-cyan)',
                        transition: 'transform var(--transition-fast)'
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'translateX(-50%) scale(0.95)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'translateX(-50%) scale(1)'}
                >
                    <Mic size={32} />
                </button>
            </div>

        </div>
    );
};

export default Dashboard;
