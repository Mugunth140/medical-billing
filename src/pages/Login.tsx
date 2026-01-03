// =====================================================
// Velan Medicals - Login Page
// Modern authentication screen with brand logo
// =====================================================

import { AlertCircle, Lock, User } from 'lucide-react';
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
                    background: #1a1f2e;
                    position: relative;
                    overflow: hidden;
                }

                .login-container::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    right: 0;
                    width: 60%;
                    height: 100%;
                    background: #1a1f2e;
                }

                @keyframes shimmer {
                    0% { opacity: 0.5; transform: translateX(-5%); }
                    100% { opacity: 1; transform: translateX(0); }
                }

                .login-left {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    padding: var(--space-8);
                    position: relative;
                    z-index: 1;
                }

                .login-left-content {
                    text-align: center;
                    color: white;
                    max-width: 400px;
                }

                .login-left h2 {
                    font-size: 2.5rem;
                    font-weight: 700;
                    margin-bottom: var(--space-4);
                    background: linear-gradient(135deg, #fff 0%, #a8dadc 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .login-left p {
                    font-size: var(--text-lg);
                    color: var(--color-gray-400);
                    line-height: 1.6;
                }

                .login-features {
                    margin-top: var(--space-8);
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4);
                }

                .login-feature {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-3);
                    color: var(--color-gray-300);
                    font-size: var(--text-sm);
                }

                .login-feature::before {
                    content: '✓';
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    background: linear-gradient(135deg, var(--color-success-500), var(--color-success-600));
                    border-radius: 50%;
                    color: white;
                    font-size: 12px;
                    font-weight: bold;
                }

                .login-right {
                    width: 520px;
                    background: #ffffff;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    padding: var(--space-12);
                    position: relative;
                    z-index: 1;
                    box-shadow: -20px 0 60px rgba(0, 0, 0, 0.3);
                }

                .login-form-wrapper {
                    width: 100%;
                    max-width: 360px;
                }

                .login-logo {
                    display: flex;
                    justify-content: center;
                    margin-bottom: var(--space-6);
                }

                .login-logo img {
                    height: 120px;
                    width: auto;
                    object-fit: contain;
                }

                .login-form-header {
                    text-align: center;
                    margin-bottom: var(--space-8);
                }

                .login-form-header h1 {
                    font-size: var(--text-2xl);
                    font-weight: 700;
                    color: #1a1f2e;
                    margin-bottom: var(--space-2);
                }

                .login-form-header p {
                    color: #64748b;
                    margin: 0;
                    font-size: var(--text-sm);
                }

                .login-error {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    padding: var(--space-3) var(--space-4);
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    border-radius: var(--radius-lg);
                    color: #dc2626;
                    font-size: var(--text-sm);
                    margin-bottom: var(--space-5);
                }

                .login-input-group {
                    position: relative;
                    margin-bottom: var(--space-4);
                }

                .login-input-label {
                    display: block;
                    font-size: var(--text-sm);
                    font-weight: 500;
                    color: #374151;
                    margin-bottom: var(--space-2);
                }

                .login-input-icon {
                    position: absolute;
                    left: var(--space-4);
                    top: 50%;
                    transform: translateY(-50%);
                    color: #9ca3af;
                    pointer-events: none;
                }

                .login-input {
                    width: 100%;
                    padding: var(--space-3) var(--space-4);
                    padding-left: calc(var(--space-4) + var(--space-8));
                    font-size: var(--text-base);
                    border: 2px solid #e5e7eb;
                    border-radius: var(--radius-lg);
                    transition: all var(--transition-fast);
                    background: #f9fafb;
                    color: #1f2937;
                }

                .login-input::placeholder {
                    color: #9ca3af;
                }

                .login-input:hover {
                    border-color: #d1d5db;
                    background: #ffffff;
                }

                .login-input:focus {
                    outline: none;
                    border-color: #1e8eb4;
                    background: #ffffff;
                    box-shadow: 0 0 0 4px rgba(30, 142, 180, 0.1);
                }

                .login-submit {
                    width: 100%;
                    padding: var(--space-4) var(--space-4);
                    margin-top: var(--space-6);
                    font-size: var(--text-base);
                    font-weight: 600;
                    background: linear-gradient(135deg, #1e8eb4 0%, #166a87 100%);
                    color: white;
                    border: none;
                    border-radius: var(--radius-lg);
                    cursor: pointer;
                    transition: all var(--transition-fast);
                    box-shadow: 0 4px 14px rgba(30, 142, 180, 0.35);
                }

                .login-submit:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(30, 142, 180, 0.4);
                }

                .login-submit:active:not(:disabled) {
                    transform: translateY(0);
                }

                .login-submit:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                    transform: none;
                }

                .login-footer {
                    margin-top: var(--space-8);
                    text-align: center;
                    font-size: var(--text-xs);
                    color: #9ca3af;
                }

                .login-footer-dark {
                    position: absolute;
                    bottom: var(--space-6);
                    left: var(--space-6);
                    font-size: var(--text-xs);
                    color: var(--color-gray-500);
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
                <div className="login-left-content">
                    <h2>Welcome Back</h2>
                    <p>Your complete solution for medical billing, inventory management, and GST compliance.</p>

                    <div className="login-features">
                        <div className="login-feature">GST-compliant invoicing</div>
                        <div className="login-feature">Real-time inventory tracking</div>
                        <div className="login-feature">Batch & expiry management</div>
                        <div className="login-feature">Comprehensive reporting</div>
                    </div>
                </div>

                <div className="login-footer-dark">
                    © 2026 Velan Medicals
                </div>
            </div>

            <div className="login-right">
                <div className="login-form-wrapper">
                    <div className="login-logo">
                        <img src="/logo.png" alt="Velan Medicals" />
                    </div>

                    <div className="login-form-header">
                        <h1>Sign In</h1>
                        <p>Enter your credentials to access your account</p>
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
                        Offline Billing & Inventory Software
                    </div>
                </div>
            </div>
        </div>
    );
}
