import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ChangePasswordModal from './ChangePasswordModal';
import { useClickAway } from '@uidotdev/usehooks';
import { formatTimeVi } from '../../utils/helpers';
import axios from 'axios';
import toast from 'react-hot-toast';
import { t } from '../../utils/t';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function TopBar({ user, isSidebarCollapsed, setIsSidebarCollapsed, isMobile }) {
  const sidebarWidth = (isSidebarCollapsed || isMobile) ? '0px' : '260px';
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const notifRef = useRef(null);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [userInfo, setUserInfo] = useState({ name: 'User', avatar: 'U', username: '', role: '' });
  const userRef = useRef(null);

  useEffect(() => {
    if (user) {
      const fullName = user.fullName || user.FullName || 'User';
      const parts = fullName.trim().split(' ');
      let avatar = 'U';
      if (parts.length >= 2) {
        avatar = parts[parts.length - 1].charAt(0).toUpperCase();
      } else {
        avatar = fullName.charAt(0).toUpperCase();
      }
      setUserInfo({
        name: fullName,
        avatar,
        username: user.mnv || user.Username || '',
        role: user.role || user.Role || ''
      });
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('csr_token');
      if (!token) return;
      const res = await axios.get(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(res.data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {

    fetchNotifications();

    const token = localStorage.getItem('csr_token');
    const evtSource = new EventSource(`${API_URL}/notifications/stream?token=${token}`);

    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_NOTIFICATION') {
          // Phát âm thanh
          const audio = new Audio('/noti.mp3');
          audio.play().catch(e => console.log('Audio play failed:', e));

          // Hiện toast
          toast.success(
            (t) => (
              <div
                className="cursor-pointer"
                onClick={() => {
                  toast.dismiss(t.id);
                  if (data.projectId) {
                    navigate(`/?projectId=${data.projectId}`);
                  } else {
                    navigate('/');
                  }
                }}
              >
                <div className="font-bold mb-1">Thông báo hệ thống</div>
                <div className="text-sm">{data.message}</div>
              </div>
            ),
            {
              duration: 5000,
              position: 'bottom-right'
            }
          );

          // Cập nhật lại list
          fetchNotifications();
        }
      } catch (e) { }
    };

    return () => {
      evtSource.close();
    };
  }, [userInfo.role]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifMenu(false);
      }
      if (userRef.current && !userRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('csr_token');
    localStorage.removeItem('csr_user');
    window.location.href = '/';
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('csr_token');
      await axios.put(`${API_URL}/notifications/mark-read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter(n => !n.IsRead).length;

  return (
    <header
      className="fixed top-0 right-0 h-16 bg-surface-container-lowest border-b border-outline-variant flex justify-between items-center px-gutter z-40 shadow-sm transition-all duration-300"
      style={{ width: `calc(100% - ${sidebarWidth})` }}
    >
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors cursor-pointer p-2 rounded-full hover:bg-surface-container"
        >
          {isSidebarCollapsed ? 'menu' : 'menu_open'}
        </button>
        <h1 className="text-base sm:text-2xl font-bold text-primary tracking-tight truncate" title={t('app.title')}>
          <span className="hidden sm:inline">{t('app.title')}</span>
          <span className="sm:hidden">Quản Lý Khách Hàng</span>
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <Link
          to="/new"
          className="bg-primary text-on-primary p-2 sm:px-4 sm:py-2 rounded-full sm:rounded-lg font-label-md flex items-center gap-2 hover:bg-primary-container transition-colors no-underline"
          title={t('app.createBtn')}
        >
          <span className="material-symbols-outlined">add</span>
          <span className="hidden sm:inline">{t('app.createBtn')}</span>
        </Link>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative hover:bg-surface-container rounded-full p-2 transition-all"
          >
            <span className="material-symbols-outlined text-on-surface-variant">
              notifications
            </span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-[11px] font-semibold text-white leading-none ring-2 ring-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-[400px] bg-surface shadow-elevation-3 rounded-xl border border-outline-variant overflow-hidden z-50 flex flex-col max-h-[450px]">
              <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
                <h3 className="font-bold text-title-md text-on-surface">Thông báo</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-primary hover:text-primary-hover text-label-md font-bold transition-colors">
                    Đánh dấu đã đọc
                  </button>
                )}
              </div>
              <div className="overflow-y-auto custom-scrollbar flex-1">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-on-surface-variant">Không có thông báo nào</div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.Id}
                      className={`p-4 border-b border-outline-variant hover:bg-surface-container transition-colors cursor-pointer ${!n.IsRead ? 'bg-primary/5' : ''}`}
                      onClick={() => {
                        setShowNotifMenu(false);
                        if (n.ProjectId) {
                          navigate(`/?projectId=${n.ProjectId}`);
                        } else {
                          navigate('/');
                        }
                      }}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-label-md text-on-surface truncate pr-2">Thông báo hệ thống</span>
                        <span className="text-xs text-on-surface-variant whitespace-nowrap">
                          {formatTimeVi(n.CreatedAt, 'HH:mm dd/MM')}
                        </span>
                      </div>
                      <p className="text-body-md text-on-surface-variant">{n.Message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative" ref={userRef}>
          <div
            className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-[#ff6b00] font-bold text-lg cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            {userInfo.avatar}
          </div>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-surface shadow-elevation-3 rounded-xl border border-outline-variant overflow-hidden z-50">
              <div className="p-4 border-b border-outline-variant flex flex-col items-center bg-surface-container-lowest">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-[#ff6b00] font-bold text-2xl mb-2 shadow-sm">
                  {userInfo.avatar}
                </div>
                <h3 className="font-bold text-title-sm text-on-surface text-center mb-1">{userInfo.name}</h3>
                <p className="text-body-sm text-on-surface-variant mb-2">@{userInfo.username}</p>
                <span className="bg-orange-500 text-white px-3 py-1 rounded-md text-[11px] font-bold shadow-sm">
                  {userInfo.role === 'Admin' ? t('app.adminBadge') : userInfo.role}
                </span>
              </div>
              <div className="p-2 bg-surface">
                <button
                  onClick={() => { setShowUserMenu(false); setShowPasswordModal(true); }}
                  className="w-full px-4 py-2 hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2 rounded-lg text-on-surface font-label-md font-bold border border-transparent hover:border-outline-variant"
                >
                  <span className="material-symbols-outlined text-lg">key</span>
                  {t('app.changePassword')}
                </button>
                <div className="h-px bg-outline-variant my-1 mx-2"></div>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 border border-error text-error hover:bg-error hover:text-white transition-colors flex items-center justify-center gap-2 rounded-lg font-bold font-label-md shadow-sm"
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                  {t('app.logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </header>
  );
}
