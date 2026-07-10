import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { t } from '../../utils/t';

export default function Sidebar({ userRole, isCollapsed, setIsCollapsed, isMobile }) {
  const [expandedGroups, setExpandedGroups] = useState({ business: true, config: false });

  const toggleGroup = (group) => {
    if (!isCollapsed) {
      setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    }
  };

  const handleLinkClick = () => {
    if (isMobile && setIsCollapsed) {
      setIsCollapsed(true);
    }
  };

  const activeClass = "flex items-center gap-3 px-4 py-3 text-primary bg-secondary-fixed rounded-lg font-bold font-label-md text-label-md whitespace-nowrap overflow-hidden";
  const inactiveClass = "flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-high transition-colors rounded-lg font-label-md text-label-md whitespace-nowrap overflow-hidden";

  return (
    <>
      {/* Backdrop overlay for mobile screens when expanded */}
      {isMobile && !isCollapsed && (
        <div 
          className="fixed inset-0 bg-black/45 z-40 transition-opacity duration-300"
          onClick={() => setIsCollapsed && setIsCollapsed(true)}
        />
      )}

      <aside 
        className={`fixed left-0 top-0 h-full bg-surface border-r border-outline-variant flex flex-col py-stack-lg z-50 transition-all duration-300 ${isCollapsed ? 'overflow-hidden border-none' : ''}`}
        style={{ 
          width: isCollapsed ? '0px' : '260px',
          boxShadow: isMobile && !isCollapsed ? 'var(--shadow-lg)' : 'none'
        }}
      >
        <div className={`px-4 mb-8 flex items-center justify-center`}>
          {!isCollapsed && (
            <div className="flex items-center">
              <img src="/logo.png" alt="Vietsun Logo" className="h-14 w-auto object-contain" />
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-2 overflow-y-auto custom-scrollbar overflow-x-hidden">
          {/* GROUP 1: Nghiệp vụ */}
          <div 
            className="flex items-center justify-between px-3 py-2 cursor-pointer text-on-surface-variant hover:text-primary transition-colors"
            onClick={() => toggleGroup('business')}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">💼</span>
              {!isCollapsed && <span className="font-bold text-sm uppercase tracking-wider">Nghiệp vụ</span>}
            </div>
            {!isCollapsed && (
              <span className="text-xs">{expandedGroups.business ? '▼' : '▶'}</span>
            )}
          </div>

          {expandedGroups.business && (
            <div className="space-y-1 mb-4">
              <NavLink to="/" end className={({ isActive }) => isActive ? activeClass : inactiveClass} title="Tổng quan" onClick={handleLinkClick}>
                <span className="text-lg">🏠</span>
                {!isCollapsed && <span>{t('menu.dashboard')}</span>}
              </NavLink>
              <NavLink to="/submissions" className={({ isActive }) => isActive ? activeClass : inactiveClass} title="Danh sách đơn" onClick={handleLinkClick}>
                <span className="text-lg">📋</span>
                {!isCollapsed && <span>Danh sách đơn</span>}
              </NavLink>
              <NavLink to="/new" className={({ isActive }) => isActive ? activeClass : inactiveClass} title={t('menu.newSubmission')} onClick={handleLinkClick}>
                <span className="text-lg">📝</span>
                {!isCollapsed && <span>{t('menu.newSubmission')}</span>}
              </NavLink>
              <NavLink to="/guest-calendar" className={({ isActive }) => isActive ? activeClass : inactiveClass} title={t('menu.guestCalendar')} onClick={handleLinkClick}>
                <span className="text-lg">🗓️</span>
                {!isCollapsed && <span>{t('menu.guestCalendar')}</span>}
              </NavLink>
              <NavLink to="/tasks" className={({ isActive }) => isActive ? activeClass : inactiveClass} title="Quản lý công việc" onClick={handleLinkClick}>
                <span className="text-lg">🎯</span>
                {!isCollapsed && <span>Quản lý công việc</span>}
              </NavLink>
              {(['Admin','BOD','PRD'].includes(userRole)) && (
                <>
                  <NavLink to="/feedback-management" className={({ isActive }) => isActive ? activeClass : inactiveClass} title="Quản lý Phản hồi" onClick={handleLinkClick}>
                    <span className="text-lg">💬</span>
                    {!isCollapsed && <span>Quản lý Phản hồi</span>}
                  </NavLink>
                  <NavLink to="/reports" className={({ isActive }) => isActive ? activeClass : inactiveClass} title="Báo cáo & Thống kê" onClick={handleLinkClick}>
                    <span className="text-lg">📊</span>
                    {!isCollapsed && <span>Báo cáo & Thống kê</span>}
                  </NavLink>
                </>
              )}
            </div>
          )}

          {/* GROUP 2: Cấu hình hệ thống */}
          {(userRole === 'Admin' || userRole === 'PRD') && (
            <>
              <div 
                className="flex items-center justify-between px-3 py-2 cursor-pointer text-on-surface-variant hover:text-primary transition-colors mt-4"
                onClick={() => toggleGroup('config')}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚙️</span>
                  {!isCollapsed && <span className="font-bold text-sm uppercase tracking-wider">Cấu hình hệ thống</span>}
                </div>
                {!isCollapsed && (
                  <span className="text-xs">{expandedGroups.config ? '▼' : '▶'}</span>
                )}
              </div>

              {expandedGroups.config && (
                <div className="space-y-1 mb-4">
                  {userRole === 'Admin' && (
                    <NavLink to="/config/users" className={({ isActive }) => isActive ? activeClass : inactiveClass} title="DS Tài khoản" onClick={handleLinkClick}>
                      <span className="text-lg">👥</span>
                      {!isCollapsed && <span>DS Tài khoản</span>}
                    </NavLink>
                  )}
                  <NavLink to="/config/tasks" className={({ isActive }) => isActive ? activeClass : inactiveClass} title="DS Công việc" onClick={handleLinkClick}>
                    <span className="text-lg">✅</span>
                    {!isCollapsed && <span>DS Công việc</span>}
                  </NavLink>
                  <NavLink to="/config/locations" className={({ isActive }) => isActive ? activeClass : inactiveClass} title="DS Địa điểm" onClick={handleLinkClick}>
                    <span className="text-lg">🏢</span>
                    {!isCollapsed && <span>DS Địa điểm</span>}
                  </NavLink>
                  <NavLink to="/config/customers" className={({ isActive }) => isActive ? activeClass : inactiveClass} title="DS Khách hàng" onClick={handleLinkClick}>
                    <span className="text-lg">🤝</span>
                    {!isCollapsed && <span>DS Khách hàng</span>}
                  </NavLink>
                  <NavLink to="/config/email-campaigns" className={({ isActive }) => isActive ? activeClass : inactiveClass} title="Email Marketing" onClick={handleLinkClick}>
                    <span className="text-lg">📧</span>
                    {!isCollapsed && <span>Email Marketing</span>}
                  </NavLink>
                  <NavLink to="/config/restaurants" className={({ isActive }) => isActive ? activeClass : inactiveClass} title="Nhà hàng & Thực đơn" onClick={handleLinkClick}>
                    <span className="text-lg">🍽️</span>
                    {!isCollapsed && <span>Nhà hàng & Thực đơn</span>}
                  </NavLink>
                  <NavLink to="/config/meeting-rooms" className={({ isActive }) => isActive ? activeClass : inactiveClass} title="Phòng họp" onClick={handleLinkClick}>
                    <span className="text-lg">🚪</span>
                    {!isCollapsed && <span>Phòng họp</span>}
                  </NavLink>
                  {userRole === 'Admin' && (
                    <NavLink to="/config/audit-logs" className={({ isActive }) => isActive ? activeClass : inactiveClass} title="Lịch sử hệ thống" onClick={handleLinkClick}>
                      <span className="text-lg">🕒</span>
                      {!isCollapsed && <span>Lịch sử hệ thống</span>}
                    </NavLink>
                  )}
                </div>
              )}
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
