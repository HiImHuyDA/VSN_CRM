// src/components/layout/Header.jsx
import { NavLink } from 'react-router-dom';

export default function Header() {
  return (
    <header className="app-header">
      <div className="header-inner">
        <NavLink to="/" className="header-logo">
          <div className="header-logo-icon">🤝</div>
          <span>CSR Reception</span>
        </NavLink>
        <nav className="header-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            📋 Danh sách đơn
          </NavLink>
          <NavLink
            to="/new"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            ✏️ Tạo đơn mới
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
