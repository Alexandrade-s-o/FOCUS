import React, { createContext, useState, useContext, useEffect } from 'react';
import { fetchProjects, deleteProjectFromApi, toggleChecklistItem } from './aiService';

const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
    const [projects, setProjects] = useState([]);

    const [currentView, setCurrentView] = useState('dashboard'); // dashboard, record, processing, project
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [currentAudioBlob, setCurrentAudioBlob] = useState(null);

    // Fetch from database on load
    useEffect(() => {
        const loadProjects = async () => {
            try {
                const data = await fetchProjects();
                setProjects(data);
            } catch (e) { console.error(e); }
        }
        loadProjects();
    }, []);

    const addProject = (projectData) => {
        setProjects(prev => [projectData, ...prev]);
    };

    const updateProject = (projectId, updatedData) => {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updatedData } : p));
    };

    const deleteProject = async (projectId) => {
        try {
            await deleteProjectFromApi(projectId);
            setProjects(prev => prev.filter(p => p.id !== projectId));
            if (activeProjectId === projectId) {
                setCurrentView('dashboard');
                setActiveProjectId(null);
            }
        } catch (e) { console.error(e); }
    };

    const toggleTaskCompletion = async (projectId, taskId) => {
        const originalProjects = [...projects];
        setProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                const updatedChecklist = p.checklist.map(task =>
                    task.id === taskId ? { ...task, completed: !task.completed } : task
                );
                return { ...p, checklist: updatedChecklist };
            }
            return p;
        }));

        try {
            const project = originalProjects.find(p => p.id === projectId);
            const task = project.checklist.find(t => t.id === taskId);
            await toggleChecklistItem(projectId, taskId, !task.completed);
        } catch (e) {
            console.error(e);
            setProjects(originalProjects);
        }
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
