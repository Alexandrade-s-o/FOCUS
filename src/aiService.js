// Usará la variable de entorno en producción, o localhost en desarrollo
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const mockProcessRecording = async (audioBlob) => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const response = await fetch(`${API_BASE}/process-audio`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errMsg = 'Error al comunicarse con la IA';
    try {
      const errData = await response.json();
      errMsg = errData.details || errData.error || errMsg;
    } catch (e) { }
    throw new Error(errMsg);
  }

  const data = await response.json();
  return data;
};

export const fetchProjects = async () => {
  const response = await fetch(`${API_BASE}/projects`);
  if (!response.ok) throw new Error('Failed to fetch projects');
  return await response.json();
};

export const deleteProjectFromApi = async (id) => {
  const response = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete project');
  return await response.json();
};

export const toggleChecklistItem = async (projectId, taskId, completed) => {
  const response = await fetch(`${API_BASE}/projects/${projectId}/checklist/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed })
  });
  if (!response.ok) throw new Error('Failed to update task');
  return await response.json();
};

export const mockAiChatResponse = async (question, context) => {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context }),
  });

  if (!response.ok) {
    return {
      id: Date.now().toString(),
      sender: 'ai',
      text: "Hubo un problema al procesar tu respuesta con Gemini. Intenta de nuevo.",
      timestamp: new Date().toISOString()
    };
  }

  const data = await response.json();

  return {
    id: Date.now().toString(),
    sender: 'ai',
    text: data.reply,
    timestamp: new Date().toISOString()
  };
};
