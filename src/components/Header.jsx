import React from 'react';
import { useAppContext } from '../AppContext';
import { ArrowLeft, Menu } from 'lucide-react';

const Header = () => {
    const { currentView, navigateTo } = useAppContext();

    const showBackButton = currentView !== 'dashboard' && currentView !== 'recording';

    return (
        <header style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-main)',
            position: 'sticky',
            top: 0,
            zIndex: 10
        }}>
            {showBackButton ? (
                <button onClick={() => navigateTo('dashboard')} style={{ color: 'var(--text-primary)' }}>
                    <ArrowLeft size={24} />
                </button>
            ) : (
                <button style={{ color: 'var(--text-primary)' }}>
                    <Menu size={24} />
                </button>
            )}
            <h1 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: 'var(--text-primary)',
                margin: 0
            }}>
                focus<span style={{ color: 'var(--accent-cyan)' }}>.</span>
            </h1>
            <div style={{ width: 24 }} /> {/* Empty div for flex balance */}
        </header>
    );
};

export default Header;
