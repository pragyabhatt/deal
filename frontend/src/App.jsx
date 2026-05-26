import React, { useState } from 'react';
import { useAuth, AuthProvider } from './context/AuthContext';
import Dashboard from './components/Dashboard';
import SupervisorView from './components/SupervisorView';
import AdminView from './components/AdminView';
import { Activity, ShieldAlert, LogOut, User, FolderKanban, BarChart4 } from 'lucide-react';
const DashboardShell = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Premium Cyber Navigation Bar */}
      <header className="glass-panel" style={{
        margin: '16px',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: '12px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={24} color="#00ffd5" style={{ filter: 'drop-shadow(0 0 8px rgba(0, 255, 213, 0.6))' }} />
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            fontWeight: 800,
            letterSpacing: '0.5px',
            background: 'linear-gradient(90deg, #ffffff 0%, #00ffd5 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            DEAL LABS
          </span>
          <span style={{
            fontSize: '11px',
            background: 'rgba(255, 255, 255, 0.07)',
            padding: '2px 8px',
            borderRadius: '10px',
            color: 'var(--text-muted)',
            fontWeight: 500,
            letterSpacing: '0.5px'
          }}>
            DRDO
          </span>
        </div>

        {/* Dashboard Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`btn-secondary ${activeTab === 'dashboard' ? 'active-nav-btn' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: activeTab === 'dashboard' ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
              color: activeTab === 'dashboard' ? 'var(--color-primary)' : 'var(--text-main)',
              textShadow: activeTab === 'dashboard' ? '0 0 8px rgba(0, 255, 213, 0.3)' : 'none',
              background: activeTab === 'dashboard' ? 'rgba(0, 255, 213, 0.04)' : 'rgba(255, 255, 255, 0.02)'
            }}
          >
            <BarChart4 size={16} />
            KPI Dashboard
          </button>

          {/* Supervisor Audit Access Control */}
          {(user?.role === 'supervisor' || user?.role === 'admin') && (
            <button
              onClick={() => setActiveTab('supervisor')}
              className={`btn-secondary ${activeTab === 'supervisor' ? 'active-nav-btn' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: activeTab === 'supervisor' ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                color: activeTab === 'supervisor' ? 'var(--color-primary)' : 'var(--text-main)',
                textShadow: activeTab === 'supervisor' ? '0 0 8px rgba(0, 255, 213, 0.3)' : 'none',
                background: activeTab === 'supervisor' ? 'rgba(0, 255, 213, 0.04)' : 'rgba(255, 255, 255, 0.02)'
              }}
            >
              <FolderKanban size={16} />
              Run Audits
            </button>
          )}

          {/* Admin User Management Access Control */}
          {user?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`btn-secondary ${activeTab === 'admin' ? 'active-nav-btn' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: activeTab === 'admin' ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                color: activeTab === 'admin' ? 'var(--color-primary)' : 'var(--text-main)',
                textShadow: activeTab === 'admin' ? '0 0 8px rgba(0, 255, 213, 0.3)' : 'none',
                background: activeTab === 'admin' ? 'rgba(0, 255, 213, 0.04)' : 'rgba(255, 255, 255, 0.02)'
              }}
            >
              <ShieldAlert size={16} />
              User Control
            </button>
          )}
        </nav>

        {/* User Identity and Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="pulse-indicator"></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-bright)' }}>{user?.username}</span>
              <span style={{ fontSize: '10px', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
                {user?.role}
              </span>
            </div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <User size={16} color="var(--text-muted)" />
            </div>
          </div>

          <button
            onClick={logout}
            className="btn-secondary"
            style={{
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: 'rgba(239, 68, 68, 0.2)',
              color: '#ef4444'
            }}
          >
            <LogOut size={14} />
            Exit
          </button>
        </div>
      </header>

      {/* Main Panel Content Area */}
      <main style={{ flex: 1, padding: '0 16px 16px 16px' }}>
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'supervisor' && <SupervisorView />}
        {activeTab === 'admin' && <AdminView />}
      </main>
    </div>
  );
};

const LoginScreen = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please provide all details');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Incorrect credentials');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px',
        borderRadius: '16px',
        position: 'relative'
      }}>
        {/* Subtle decorative glowing bars */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)',
        }} />

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'rgba(0, 255, 213, 0.05)',
            border: '1px solid rgba(0, 255, 213, 0.15)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 0 15px rgba(0, 255, 213, 0.1)'
          }}>
            <Activity size={24} color="#00ffd5" />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800 }}>DEAL LABS</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
            Defense Research and Development Organisation
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.07)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              padding: '12px',
              borderRadius: '6px',
              color: 'var(--color-danger)',
              fontSize: '13px',
              marginBottom: '20px',
              fontWeight: 500
            }}>
              {error}
            </div>
          )}

          <div className="input-group">
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="custom-input"
              placeholder="e.g. analyst"
              required
            />
          </div>

          <div className="input-group" style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="custom-input"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {submitting ? (
              <>
                <span className="spinner"></span>
                Verifying Credentials...
              </>
            ) : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifycontent: 'center', background: 'var(--bg-main)', flexDirection: 'column', gap: '16px' }}>
        <span className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></span>
        <span style={{ fontSize: '14px', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Loading Portal Secure Layer...</span>
      </div>
    );
  }

  return isAuthenticated ? <DashboardShell /> : <LoginScreen />;
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
