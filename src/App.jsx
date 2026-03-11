import React from 'react';
import { useAppContext } from './AppContext';
import Dashboard from './views/Dashboard';
import RecordView from './views/RecordView';
import ProcessingView from './views/ProcessingView';
import ProjectDetailView from './views/ProjectDetailView';
import Header from './components/Header';

function App() {
  const { currentView } = useAppContext();

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'record': return <RecordView />;
      case 'processing': return <ProcessingView />;
      case 'project': return <ProjectDetailView />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="app-container">
      <div className="mobile-container">
        <Header />
        <main className="content-area" style={{ flex: 1, overflowY: 'auto' }}>
          {renderView()}
        </main>
      </div>
    </div>
  );
}

export default App;
