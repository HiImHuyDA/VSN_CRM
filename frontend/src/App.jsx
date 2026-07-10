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
import TaskManagement from './pages/TaskManagement';
import CustomerEvaluation from './pages/CustomerEvaluation';
import FeedbackManagement from './pages/FeedbackManagement';

function App() {
  const [auth, setAuth] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

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

  return (
    <BrowserRouter>
      <div 
        className="bg-background text-on-background selection:bg-primary-fixed selection:text-on-primary-fixed font-body-md min-h-screen"
        style={{ '--current-sidebar-width': sidebarWidth }}
      >
        <Sidebar 
          userRole={auth.role} 
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
            <Route path="/"             element={<Dashboard />} />
            <Route path="/submissions"  element={<SubmissionList />} />
            <Route path="/new"          element={<NewSubmission currentUser={auth} />} />
            <Route path="/edit/:projectId" element={<NewSubmission currentUser={auth} />} />
            <Route path="/guest-calendar" element={<GuestCalendar />} />
            <Route path="/tasks"          element={<TaskManagement />} />
            <Route path="/feedback-management" element={<FeedbackManagement />} />
            <Route path="/public/evaluation/:projectId" element={<CustomerEvaluation />} />


            {/* Báo cáo — chỉ BOD, PRD, Admin */}
            {(['Admin','BOD','PRD'].includes(auth.role)) && (
              <Route path="/reports" element={<Reports />} />
            )}
            
            {/* Cấu hình hệ thống (Admin & PRD) */}
            {(auth.role === 'Admin' || auth.role === 'PRD') && (
              <>
                {auth.role === 'Admin' && (
                  <>
                    <Route path="/config/users" element={<UserConfig />} />
                    <Route path="/config/audit-logs"    element={<AuditLogs />} />
                  </>
                )}
                <Route path="/config/tasks"         element={<TaskConfigPage />} />
                <Route path="/config/locations"     element={<LocationConfig />} />
                <Route path="/config/customers"     element={<CustomerConfig />} />
                <Route path="/config/email-campaigns" element={<EmailCampaignConfig />} />
                <Route path="/config/restaurants"   element={<RestaurantConfig />} />
                <Route path="/config/meeting-rooms" element={<MeetingRoomConfig />} />
                <Route path="/config/*" element={<Navigate to="/config/tasks" replace />} />
              </>
            )}
            
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
          error:   { iconTheme: { primary: '#FF4D4F', secondary: '#ffffff' } },
        }}
      />
    </BrowserRouter>
  );
}

export default App;
