// =====================================================
// MedBill - Login Page
// Modern authentication screen
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
        <div className="login-container">
            <style>{`
                .login-container {
                    min-height: 100vh;
                    display: flex;
                    background: linear-gradient(135deg, #0f1219 0%, #1a1f2e 50%, #0f1219 100%);
                    position: relative;
                    overflow: hidden;
                }

                .login-container::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle at 30% 30%, rgba(30, 142, 180, 0.08) 0%, transparent 50%),
                                radial-gradient(circle at 70% 70%, rgba(30, 142, 180, 0.05) 0%, transparent 50%);
                    animation: pulse 15s ease-in-out infinite;
                }

                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.8; }
                }

                .login-left {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-8);
                    position: relative;
                    z-index: 1;
                }

                .login-brand {
                    text-align: center;
                    color: white;
                }

                .login-logo {
                    width: 80px;
                    height: 80px;
                    background: linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-600) 100%);
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto var(--space-6);
                    box-shadow: 0 8px 32px rgba(30, 142, 180, 0.3);
                }

                .login-brand h1 {
                    font-size: 2rem;
                    font-weight: 700;
                    margin-bottom: var(--space-2);
                    letter-spacing: -0.02em;
                }

                .login-brand p {
                    font-size: var(--text-base);
                    opacity: 0.7;
                    margin: 0;
                }

                .login-right {
                    width: 480px;
                    background: var(--bg-secondary);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    padding: var(--space-12);
                    position: relative;
                    z-index: 1;
                }

                .login-form-header {
                    margin-bottom: var(--space-8);
                }

                .login-form-header h2 {
                    font-size: var(--text-2xl);
                    font-weight: 600;
                    margin-bottom: var(--space-2);
                    color: var(--text-primary);
                }

                .login-form-header p {
                    color: var(--text-secondary);
                    margin: 0;
                }

                .login-error {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    padding: var(--space-3) var(--space-4);
                    background: var(--color-danger-50);
                    border: 1px solid var(--color-danger-200);
                    border-radius: var(--radius-lg);
                    color: var(--color-danger-700);
                    font-size: var(--text-sm);
                    margin-bottom: var(--space-5);
                }

                .login-input-group {
                    position: relative;
                    margin-bottom: var(--space-4);
                }

                .login-input-icon {
                    position: absolute;
                    left: var(--space-4);
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-tertiary);
                    pointer-events: none;
                }

                .login-input {
                    width: 100%;
                    padding: var(--space-3) var(--space-4);
                    padding-left: calc(var(--space-4) + var(--space-8));
                    font-size: var(--text-base);
                    border: 1px solid var(--border-light);
                    border-radius: var(--radius-lg);
                    transition: all var(--transition-fast);
                    background: var(--bg-secondary);
                }

                .login-input:hover {
                    border-color: var(--border-medium);
                }

                .login-input:focus {
                    outline: none;
                    border-color: var(--color-primary-500);
                    box-shadow: 0 0 0 3px rgba(30, 142, 180, 0.12);
                }

                .login-submit {
                    width: 100%;
                    padding: var(--space-3) var(--space-4);
                    margin-top: var(--space-4);
                    font-size: var(--text-base);
                    font-weight: 600;
                    background: linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-600) 100%);
                    color: white;
                    border: none;
                    border-radius: var(--radius-lg);
                    cursor: pointer;
                    transition: all var(--transition-fast);
                    box-shadow: 0 4px 12px rgba(30, 142, 180, 0.25);
                }

                .login-submit:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px rgba(30, 142, 180, 0.3);
                }

                .login-submit:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .login-footer {
                    position: absolute;
                    bottom: var(--space-6);
                    left: 0;
                    right: 0;
                    text-align: center;
                    font-size: var(--text-xs);
                    color: var(--text-tertiary);
                }

                @media (max-width: 900px) {
                    .login-left {
                        display: none;
                    }
                    .login-right {
                        width: 100%;
                        max-width: 100%;
                    }
                }
            `}</style>

            <div className="login-left">
                <div className="login-brand">
                    <div className="login-logo">
                        <Pill size={40} strokeWidth={1.5} color="white" />
                    </div>
                    <h1>Medical Billing</h1>
                    <p>Billing & Inventory Management</p>
                </div>
            </div>

            <div className="login-right">
                <div className="login-form-header">
                    <h2>Welcome back</h2>
                    <p>Sign in to your account to continue</p>
                </div>

                {error && (
                    <div className="login-error">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="login-input-group">
                        <User size={20} className="login-input-icon" />
                        <input
                            type="text"
                            className="login-input"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoFocus
                            autoComplete="username"
                        />
                    </div>

                    <div className="login-input-group">
                        <Lock size={20} className="login-input-icon" />
                        <input
                            type="password"
                            className="login-input"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="login-submit"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="login-footer">
                    Offline Medical Billing Software
                </div>
            </div>
        </div>
    );
}
