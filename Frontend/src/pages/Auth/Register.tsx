import React, { useState } from 'react';

interface RegisterProps {
    onRegisterSuccess: () => void;
    onNavigateToLogin: () => void;
}

const Register: React.FC<RegisterProps> = ({ onRegisterSuccess, onNavigateToLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError("Passwords don't match");
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                onRegisterSuccess();
            } else {
                setError(data.error || 'Registration failed');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ width: '100%', padding: '24px' }}>
            <h2 style={{ color: 'hsl(220, 25%, 18%)', textAlign: 'center', marginBottom: '24px' }}>สร้างบัญชีใหม่</h2>

            {error && (
                <div style={{ background: 'hsla(0, 80%, 95%, 1)', border: '1px solid hsla(0, 70%, 80%, 0.5)', color: 'hsl(0, 70%, 45%)', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <label style={{ color: 'hsl(220, 15%, 45%)', fontSize: '0.9rem', marginBottom: '4px', display: 'block' }}>ชื่อผู้ใช้</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="diary-input"
                        style={{
                            width: '100%',
                            minHeight: '48px',
                            background: 'rgba(255, 255, 255, 0.9)',
                            border: '1px solid hsl(220, 20%, 85%)',
                            padding: '12px',
                            borderRadius: '12px',
                            color: 'hsl(220, 25%, 18%)',
                            fontSize: '1rem',
                            lineHeight: 'normal'
                        }}
                        placeholder="ระบุชื่อผู้ใช้"
                        required
                    />
                </div>

                <div>
                    <label style={{ color: 'hsl(220, 15%, 45%)', fontSize: '0.9rem', marginBottom: '4px', display: 'block' }}>รหัสผ่าน</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="diary-input"
                        style={{
                            width: '100%',
                            minHeight: '48px',
                            background: 'rgba(255, 255, 255, 0.9)',
                            border: '1px solid hsl(220, 20%, 85%)',
                            padding: '12px',
                            borderRadius: '12px',
                            color: 'hsl(220, 25%, 18%)',
                            fontSize: '1rem',
                            lineHeight: 'normal'
                        }}
                        placeholder="ตั้งรหัสผ่าน"
                        required
                    />
                </div>

                <div>
                    <label style={{ color: 'hsl(220, 15%, 45%)', fontSize: '0.9rem', marginBottom: '4px', display: 'block' }}>ยืนยันรหัสผ่าน</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="diary-input"
                        style={{
                            width: '100%',
                            minHeight: '48px',
                            background: 'rgba(255, 255, 255, 0.9)',
                            border: '1px solid hsl(220, 20%, 85%)',
                            padding: '12px',
                            borderRadius: '12px',
                            color: 'hsl(220, 25%, 18%)',
                            fontSize: '1rem',
                            lineHeight: 'normal'
                        }}
                        placeholder="ยืนยันรหัสผ่านอีกครั้ง"
                        required
                    />
                </div>

                <button
                    type="submit"
                    className="btn-primary"
                    style={{ marginTop: '16px', width: '100%' }}
                    disabled={isLoading}
                >
                    {isLoading ? 'กำลังสร้างบัญชี...' : 'ลงทะเบียน'}
                </button>
            </form>

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <span style={{ color: 'hsl(220, 15%, 60%)', fontSize: '0.9rem' }}>มีบัญชีอยู่แล้ว? </span>
                <button
                    onClick={onNavigateToLogin}
                    className="btn-text"
                    style={{ color: 'var(--accent)', padding: '0', marginLeft: '4px' }}
                >
                    เข้าสู่ระบบ
                </button>
            </div>
        </div>
    );
};

export default Register;
