import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Edit2, Trash2, Key, Users, UserCheck, ShieldAlert } from 'lucide-react';

const AdminView = () => {
  const { apiFetch, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [editingId, setEditingId] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('analyst');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/users');
      if (!res.ok) {
        throw new Error('Failed to retrieve user listing');
      }
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err.message || 'Credentials database unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const clearForm = () => {
    setEditingId(null);
    setUsername('');
    setPassword('');
    setRole('analyst');
  };

  const handleEditInit = (user) => {
    setEditingId(user.id);
    setUsername(user.username);
    setPassword('');
    setRole(user.role);
    setSuccess('');
    setError('');
  };

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    if (!username) {
      setError('Username is required');
      return;
    }
    if (!editingId && !password) {
      setError('Password is required for new accounts');
      return;
    }

    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('username', username);
    if (password) formData.append('password', password);
    formData.append('role', role);

    try {
      let res;
      if (editingId) {
        res = await apiFetch(`/api/users/${editingId}`, {
          method: 'PUT',
          body: formData,
        });
      } else {
        res = await apiFetch('/api/users', {
          method: 'POST',
          body: formData,
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Operation failed');
      }

      setSuccess(editingId ? 'Credential updated successfully' : 'New account provisioned successfully');
      clearForm();
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Operation failed');
    }
  };

  const handleDeleteUser = async (userToDelete) => {
    if (userToDelete.id === currentUser.id) {
      setError('Security Block: You cannot deprovision your own active administrator account.');
      return;
    }
    
    if (!window.confirm(`Deprovision user ${userToDelete.username}? This will delete all their saved objective quality runs permanently!`)) {
      return;
    }

    setError('');
    setSuccess('');
    try {
      const res = await apiFetch(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Deprovisioning failed');
      }

      setSuccess(`Account ${userToDelete.username} deleted.`);
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Deprovisioning failed');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px', minHeight: 'calc(100vh - 120px)' }}>
      {/* Account Provisioning Form Column */}
      <section className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', borderRadius: '16px' }}>
        <div>
          <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {editingId ? <Key size={18} color="var(--color-primary)" /> : <UserPlus size={18} color="var(--color-primary)" />}
            {editingId ? 'Modify Credentials' : 'Provision Account'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
            {editingId ? 'Update details or rotate password hash.' : 'Add new identity to local DEAL directory.'}
          </p>
        </div>

        <form onSubmit={handleCreateOrUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="custom-input"
              placeholder="e.g. j.doe"
              required
            />
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="custom-input"
              placeholder={editingId ? 'Leave blank to keep current' : '••••••••'}
              required={!editingId}
            />
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Access Role Level
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="custom-select"
            >
              <option value="analyst">Analyst (Runs assessment engine)</option>
              <option value="supervisor">Supervisor (Run auditer & CSV exporter)</option>
              <option value="admin">Administrator (Full dashboard control)</option>
            </select>
          </div>

          {/* Feedback logs */}
          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.07)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '10px 12px', borderRadius: '6px', color: 'var(--color-danger)', fontSize: '12px', lineHeight: '1.4' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ background: 'rgba(16, 185, 129, 0.07)', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '10px 12px', borderRadius: '6px', color: 'var(--color-success)', fontSize: '12px', fontWeight: 500 }}>
              {success}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button type="submit" className="btn-primary" style={{ flex: 1, boxShadow: 'none' }}>
              {editingId ? 'Save Changes' : 'Create Account'}
            </button>
            {editingId && (
              <button type="button" onClick={clearForm} className="btn-secondary" style={{ flex: 0.5 }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Directory Database Column */}
      <section className="glass-panel" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="flex-between">
          <h4 style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={16} color="var(--color-primary)" />
            DEAL Account Directory
          </h4>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Active connections: {users.length}
          </span>
        </div>

        <div style={{ overflowX: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '10px' }}>
              <span className="spinner" style={{ width: '32px', height: '32px' }}></span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Accessing local user directories...</span>
            </div>
          ) : (
            <table className="audit-table" style={{ marginTop: 0 }}>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Username</th>
                  <th>Role Level</th>
                  <th>Provision Date</th>
                  <th style={{ textAlign: 'right' }}>Security Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-secondary)' }}>#00{u.id}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ padding: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'inline-flex' }}>
                          <UserCheck size={14} color="var(--text-muted)" />
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-bright)' }}>{u.username}</span>
                        {u.username === currentUser.username && (
                          <span style={{ fontSize: '9px', background: 'rgba(0, 255, 213, 0.05)', border: '1px solid rgba(0, 255, 213, 0.15)', color: 'var(--color-primary)', padding: '1px 5px', borderRadius: '4px' }}>
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: u.role === 'admin' ? 'rgba(239, 68, 68, 0.05)' : u.role === 'supervisor' ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255,255,255,0.03)',
                        border: u.role === 'admin' ? '1px solid rgba(239, 68, 68, 0.15)' : u.role === 'supervisor' ? '1px solid rgba(59, 130, 246, 0.15)' : '1px solid rgba(255,255,255,0.05)',
                        color: u.role === 'admin' ? 'var(--color-danger)' : u.role === 'supervisor' ? 'var(--color-secondary)' : 'var(--text-muted)'
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          onClick={() => handleEditInit(u)}
                          className="btn-secondary"
                          style={{ padding: '6px', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}
                          title="Edit User"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          disabled={u.id === currentUser.id}
                          className="btn-secondary"
                          style={{ padding: '6px', border: '1px solid rgba(239,68,68,0.05)', color: '#ef4444', opacity: u.id === currentUser.id ? 0.3 : 1, cursor: u.id === currentUser.id ? 'not-allowed' : 'pointer' }}
                          title="Delete User"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* DRDO Internal Security Reminder */}
        <div style={{ display: 'flex', gap: '10px', padding: '12px 16px', background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.12)', borderRadius: '8px', alignItems: 'center' }}>
          <ShieldAlert size={16} color="var(--color-warning)" />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            <strong>Internal Audit Notice:</strong> Account changes are cryptographically committed to NGINX and PostgreSQL access tables. All credential modifications are stored in immutable system log lines.
          </span>
        </div>
      </section>
    </div>
  );
};

export default AdminView;
