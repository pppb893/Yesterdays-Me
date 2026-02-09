import React, { useState } from 'react';

interface LoginProps {
  onLoginSuccess: (username: string) => void;
  onNavigateToRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onNavigateToRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        onLoginSuccess(data.username || username);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
        <h2 style={{ color: 'hsl(0, 0%, 95%)', textAlign: 'center', marginBottom: '24px' }}>ยินดีต้อนรับกลับมา</h2>

        {error && (
          <div style={{ background: 'hsla(0, 60%, 45%, 0.2)', color: 'hsl(0, 80%, 75%)', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ color: 'hsl(220, 15%, 65%)', fontSize: '0.9rem', marginBottom: '4px', display: 'block' }}>ชื่อผู้ใช้</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="diary-input"
              style={{ width: '100%', background: 'hsla(220, 30%, 20%, 0.5)', border: '1px solid hsla(220, 20%, 40%, 0.2)', padding: '12px', borderRadius: '8px', color: 'white' }}
              placeholder="กรอกชื่อผู้ใช้"
              required
            />
          </div>

          <div>
            <label style={{ color: 'hsl(220, 15%, 65%)', fontSize: '0.9rem', marginBottom: '4px', display: 'block' }}>รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="diary-input"
              style={{ width: '100%', background: 'hsla(220, 30%, 20%, 0.5)', border: '1px solid hsla(220, 20%, 40%, 0.2)', padding: '12px', borderRadius: '8px', color: 'white' }}
              placeholder="กรอกรหัสผ่าน"
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ marginTop: '8px' }}
            disabled={isLoading}
          >
            {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <span style={{ color: 'hsl(220, 15%, 60%)', fontSize: '0.9rem' }}>ยังไม่มีบัญชี? </span>
          <button
            onClick={onNavigateToRegister}
            className="btn-text"
            style={{ color: 'hsl(45, 90%, 65%)', padding: '0', marginLeft: '4px' }}
          >
            สร้างบัญชีใหม่
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
