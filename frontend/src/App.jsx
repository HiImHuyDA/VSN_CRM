// src/App.jsx
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import Dashboard from './pages/Dashboard';
import SubmissionList from './pages/SubmissionList';
import NewSubmission from './pages/NewSubmission';
import Login from './pages/Login';
import GuestCalendar from './pages/GuestCalendar';
import Reports from './pages/Reports';
import CustomerConfig from './pages/config/CustomerConfig';
import EmailCampaignConfig from './pages/config/EmailCampaignConfig';
import LocationConfig from './pages/config/LocationConfig';
import RestaurantConfig from './pages/config/RestaurantConfig';
import MeetingRoomConfig from './pages/config/MeetingRoomConfig';
import TaskConfigPage from './pages/config/TaskConfigPage';
import UserConfig from './pages/config/UserConfig';
import AuditLogs from './pages/config/AuditLogs';
import MenuPermissionsConfig from './pages/config/MenuPermissionsConfig';
import TaskManagement from './pages/TaskManagement';
import CustomerEvaluation from './pages/CustomerEvaluation';
import FeedbackManagement from './pages/FeedbackManagement';
import VehicleBookingList from './pages/vehicle/VehicleBookingList';
import VehicleBookingNew from './pages/vehicle/VehicleBookingNew';
import VehicleConfig from './pages/vehicle/VehicleConfig';
import VehicleCalendar from './pages/vehicle/VehicleCalendar';
import { getMyMenu } from './services/api';

// Map MenuKey (không đổi dù đổi tên hiển thị) -> component tương ứng.
// Menu nhóm (không có Path) không cần khai báo ở đây.
const MENU_KEY_COMPONENT = {
  'guest.dashboard': (auth) => <Dashboard />,
  'guest.submissions': (auth) => <SubmissionList />,
  'guest.new': (auth) => <NewSubmission currentUser={auth} />,
  'guest.calendar': (auth) => <GuestCalendar />,
  'guest.tasks': (auth) => <TaskManagement />,
  'guest.feedback': (auth) => <FeedbackManagement />,
  'guest.reports': (auth) => <Reports />,
  'guest.config.tasks': (auth) => <TaskConfigPage />,
  'guest.config.locations': (auth) => <LocationConfig />,
  'guest.config.customers': (auth) => <CustomerConfig />,
  'guest.config.email-campaigns': (auth) => <EmailCampaignConfig />,
  'guest.config.restaurants': (auth) => <RestaurantConfig />,
  'guest.config.meeting-rooms': (auth) => <MeetingRoomConfig />,
  'vehicle.dashboard': (auth) => <VehicleBookingList currentUser={auth} />,
  'vehicle.new': (auth) => <VehicleBookingNew />,
  'vehicle.config': (auth) => <VehicleConfig />,
  'vehicle.calendar': (auth) => <VehicleCalendar />,
  'system-config.users': (auth) => <UserConfig />,
  'system-config.audit-logs': (auth) => <AuditLogs />,

  'system-config.menu-permissions': (auth) => <MenuPermissionsConfig />,
};

function App() {
  const [auth, setAuth] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [menuTree, setMenuTree] = useState(null); // null = đang tải

  const isPublicRoute = window.location.pathname.startsWith('/public/');

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarCollapsed(true); // Default to collapsed on mobile
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('csr_user');
    if (savedUser) {
      try {
        setAuth(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('csr_user');
      }
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setMenuTree(null);
      return;
    }
    getMyMenu()
      .then(res => {
        if (res.success) setMenuTree(res.data);
      })
      .catch(err => {
        console.error('Không tải được menu:', err.message);
        setMenuTree([]); // tránh treo loading vô hạn nếu API lỗi
      });
  }, [auth]);

  if (isPublicRoute) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/public/evaluation/:projectId" element={<CustomerEvaluation />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    );
  }

  if (!auth) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<Login setAuth={setAuth} />} />
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    );
  }


  const sidebarWidth = (isSidebarCollapsed || isMobile) ? '0px' : '260px';

  // Đang chờ tải menu (tránh render sidebar rỗng/route sai trong lúc chờ)
  if (menuTree === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-on-surface-variant">
        Đang tải...
      </div>
    );
  }

  // Danh sách Path được phép truy cập (đã lọc theo Role ở backend, xem usp_GetMyMenu)
  const allowedPaths = new Set(menuTree.filter(m => m.Path).map(m => m.Path));

  return (
    <BrowserRouter>
      <div
        className="bg-background text-on-background selection:bg-primary-fixed selection:text-on-primary-fixed font-body-md min-h-screen"
        style={{ '--current-sidebar-width': sidebarWidth }}
      >
        <Sidebar
          menuTree={menuTree}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          isMobile={isMobile}
        />
        <TopBar
          user={auth}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          isMobile={isMobile}
        />
        <main
          style={{ marginLeft: sidebarWidth, transition: 'all 0.3s ease-in-out', width: `calc(100% - ${sidebarWidth})` }}
          className="mt-16 p-stack-lg min-h-screen bg-background"
        >
          <Routes>
            {/* Route sinh động từ menu đã được phân quyền — path nào không có trong allowedPaths
                sẽ không match Route nào, tự động rơi vào catch-all bên dưới => guard tự nhiên */}
            {Object.entries(MENU_KEY_COMPONENT).map(([menuKey, render]) => {
              const menuItem = menuTree.find(m => m.MenuKey === menuKey);
              if (!menuItem || !menuItem.Path) return null;
              return (
                <Route key={menuKey} path={menuItem.Path} element={render(auth)} />
              );
            })}

            {/* Route phụ không phải menu chính, nhưng gắn liền nghiệp vụ của menu tương ứng */}
            {allowedPaths.has('/new') && (
              <Route path="/edit/:projectId" element={<NewSubmission currentUser={auth} />} />
            )}
            <Route path="/public/evaluation/:projectId" element={<CustomerEvaluation />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#1D1D1D',
            border: '1px solid #E8E8E8',
            borderRadius: '8px',
            fontSize: '13.5px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          },
          success: { iconTheme: { primary: '#52C41A', secondary: '#ffffff' } },
          error: { iconTheme: { primary: '#FF4D4F', secondary: '#ffffff' } },
        }}
      />
    </BrowserRouter>
  );
}

export default App;