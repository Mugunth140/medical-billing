// =====================================================
// MedBill - Login Page
// User authentication screen
// =====================================================

import { AlertCircle, Lock, Pill, User } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { login } from '../services/auth.service';
import { useAuthStore } from '../stores';

export function Login() {
  const { setUser, setLoading, setError, isLoading, error } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const user = await login(username, password);

      if (user) {
        setUser(user);
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--color-primary-700) 0%, var(--color-primary-900) 100%)',
      padding: 'var(--space-4)'
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-2xl)',
        boxShadow: 'var(--shadow-xl)',
        width: '100%',
        maxWidth: '420px',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-600) 100%)',
          padding: 'var(--space-8)',
          textAlign: 'center',
          color: 'var(--text-inverse)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 'var(--radius-xl)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-4)',
            backdropFilter: 'blur(10px)'
          }}>
            <Pill size={40} strokeWidth={1.5} />
          </div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', marginBottom: 'var(--space-1)' }}>
            Medical Billing
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', opacity: 0.9 }}>
            Billing & Inventory Management
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: 'var(--space-8)' }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3)',
              background: 'var(--color-danger-50)',
              border: '1px solid var(--color-danger-200)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-danger-700)',
              fontSize: 'var(--text-sm)',
              marginBottom: 'var(--space-4)'
            }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ position: 'relative', marginBottom: 'var(--space-5)' }}>
              <User
                size={20}
                style={{
                  position: 'absolute',
                  left: 'var(--space-4)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)'
                }}
              />
              <input
                type="text"
                style={{
                  width: '100%',
                  padding: 'var(--space-4)',
                  paddingLeft: 'calc(var(--space-4) + var(--space-8))',
                  fontSize: 'var(--text-base)',
                  border: '2px solid var(--border-light)',
                  borderRadius: 'var(--radius-lg)',
                  transition: 'all var(--transition-fast)',
                  background: 'var(--bg-secondary)'
                }}
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>

            <div style={{ position: 'relative', marginBottom: 'var(--space-5)' }}>
              <Lock
                size={20}
                style={{
                  position: 'absolute',
                  left: 'var(--space-4)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)'
                }}
              />
              <input
                type="password"
                style={{
                  width: '100%',
                  padding: 'var(--space-4)',
                  paddingLeft: 'calc(var(--space-4) + var(--space-8))',
                  fontSize: 'var(--text-base)',
                  border: '2px solid var(--border-light)',
                  borderRadius: 'var(--radius-lg)',
                  transition: 'all var(--transition-fast)',
                  background: 'var(--bg-secondary)'
                }}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: 'var(--space-4)',
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--font-semibold)',
                background: 'linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-600) 100%)',
                color: 'var(--text-inverse)',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                transition: 'all var(--transition-fast)'
              }}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-3)',
            background: 'var(--color-primary-50)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-primary-700)'
          }}>
            <strong>Default Login:</strong><br />
            Username: <code>admin</code> | Password: <code>admin123</code>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-4)',
          background: 'var(--bg-tertiary)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)'
        }}>
          Offline Medical Billing Software
        </div>
      </div>
    </div>
  );
}
