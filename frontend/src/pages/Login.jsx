// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Login({ setAuth }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (data.success) {
        localStorage.setItem('csr_token', data.data.token);
        localStorage.setItem('csr_user', JSON.stringify(data.data.user));
        setAuth(data.data.user);
        toast.success(`Xin chào, ${data.data.user.fullName}`);
        navigate('/');
      } else {
        toast.error(data.error || 'Đăng nhập thất bại');
      }
    } catch (err) {
      toast.error('Lỗi kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoContainer}>
          <img src="/logo.png" alt="Vietsun" style={styles.logo} />
        </div>
        <h2 style={styles.title}>Hệ Thống Đón Khách CSR</h2>
        <p style={styles.subtitle}>Đăng nhập để tiếp tục</p>
        
        <form onSubmit={handleLogin} style={styles.form}>
          <div className="form-group">
            <label>Mã nhân viên</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập mã nhân viên..."
              required
            />
          </div>
          <div className="form-group">
            <label>Mật khẩu</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu..."
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={styles.button} disabled={loading}>
            {loading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-bg)',
    padding: '20px'
  },
  card: {
    background: 'var(--color-bg-card)',
    padding: '40px',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-lg)',
    width: '100%',
    maxWidth: '400px',
    border: '1px solid var(--color-border)'
  },
  logoContainer: {
    textAlign: 'center',
    marginBottom: '20px'
  },
  logo: {
    maxHeight: '50px',
    objectFit: 'contain'
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    textAlign: 'center',
    color: 'var(--color-text)',
    marginBottom: '8px'
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--color-text-muted)',
    textAlign: 'center',
    marginBottom: '30px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  button: {
    width: '100%',
    justifyContent: 'center',
    marginTop: '10px'
  }
};
