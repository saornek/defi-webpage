import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../Firebase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin');
    } catch (err) {
      setError('Invalid email or password.');
    }
    setLoading(false);
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 8,
    border: '1px solid #2e4a2e', background: '#111f11',
    color: '#fff', fontSize: 14, boxSizing: 'border-box',
    outline: 'none',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f1f0f', color: '#fff', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 24px' }}>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: '#4caf50', marginBottom: 8, textTransform: 'uppercase' }}>
            Dalyan Club
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px' }}>
            Biz Bize <span style={{ color: '#8bc34a' }}>Defi 2026</span>
          </h1>
          <p style={{ fontSize: 13, color: '#4a7a4a', margin: 0 }}>Admin access only</p>
        </div>

        <div style={{ background: '#131f13', borderRadius: 16, border: '1px solid #1e3a1e', padding: '32px 28px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 24px', textAlign: 'center' }}>Sign in</h2>

          {error && (
            <div style={{ background: '#2a0f0f', border: '1px solid #cc000044', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ff6b6b' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#4a7a4a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#8bc34a'}
                onBlur={e => e.target.style.borderColor = '#2e4a2e'}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#4a7a4a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#8bc34a'}
                onBlur={e => e.target.style.borderColor = '#2e4a2e'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '13px', fontSize: 13, fontWeight: 700, background: '#8bc34a', color: '#0f1f0f', border: 'none', borderRadius: 8, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <a href="/" style={{ fontSize: 12, color: '#2e4a2e', textDecoration: 'none' }}>← Back to ladder</a>
        </div>

      </div>
    </div>
  );
}