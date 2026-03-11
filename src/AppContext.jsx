import React, { createContext, useState, useContext, useEffect } from 'react';

const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
    const [projects, setProjects] = useState(() => {
        const saved = localStorage.getItem('adhd_projects');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return [];
            }
        }
        return [];
    });

    const [currentView, setCurrentView] = useState('dashboard'); // dashboard, record, processing, project
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [currentAudioBlob, setCurrentAudioBlob] = useState(null);

    // Save to local storage whenever projects change
    useEffect(() => {
        localStorage.setItem('adhd_projects', JSON.stringify(projects));
    }, [projects]);

    const addProject = (projectData) => {
        setProjects(prev => [projectData, ...prev]);
    };

    const updateProject = (projectId, updatedData) => {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updatedData } : p));
    };

    const deleteProject = (projectId) => {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (activeProjectId === projectId) {
            setCurrentView('dashboard');
            setActiveProjectId(null);
        }
    };

    const toggleTaskCompletion = (projectId, taskId) => {
        setProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                const updatedChecklist = p.checklist.map(task =>
                    task.id === taskId ? { ...task, completed: !task.completed } : task
                );
                return { ...p, checklist: updatedChecklist };
            }
            return p;
        }));
    };

    const navigateTo = (view, projectId = null) => {
        setCurrentView(view);
        if (projectId) setActiveProjectId(projectId);
    };

    return (
        <AppContext.Provider value={{
            projects,
            currentView,
            activeProjectId,
            currentAudioBlob,
            setCurrentAudioBlob,
            addProject,
            updateProject,
            deleteProject,
            toggleTaskCompletion,
            navigateTo
        }}>
            {children}
        </AppContext.Provider>
    );
};
