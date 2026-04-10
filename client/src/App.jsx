import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ServiceAdviceList from './pages/ServiceAdviceList';
import ServiceAdviceForm from './pages/ServiceAdviceForm';
import ServiceAdviceDetail from './pages/ServiceAdviceDetail';
import VehicleHistory from './pages/VehicleHistory';
import UserManagement from './pages/UserManagement';
import MasterData from './pages/MasterData';
import ExportExcel from './pages/ExportExcel';
import ActivityLog from './pages/ActivityLog';
import PartmanTasks from './pages/PartmanTasks';
import SATasks from './pages/SATasks';
import ForemanValidation from './pages/ForemanValidation';
import MRATasks from './pages/MRATasks';
import { Menu } from 'lucide-react';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.roleCode)) return <Navigate to="/" />;
  return children;
}

function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <div className="mobile-header">
          <button className="btn btn-ghost" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button>
          <span className="font-semibold">Wijaya Toyota CR7</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading-spinner" style={{minHeight:'100vh'}}><div className="spinner" /></div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/service-advice" element={<ProtectedRoute><AppLayout><ServiceAdviceList /></AppLayout></ProtectedRoute>} />
      <Route path="/service-advice/new" element={<ProtectedRoute roles={['SUPER_ADMIN','TEKNISI','SA']}><AppLayout><ServiceAdviceForm /></AppLayout></ProtectedRoute>} />
      <Route path="/service-advice/:id" element={<ProtectedRoute><AppLayout><ServiceAdviceDetail /></AppLayout></ProtectedRoute>} />
      <Route path="/vehicles" element={<ProtectedRoute><AppLayout><VehicleHistory /></AppLayout></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute roles={['SUPER_ADMIN']}><AppLayout><UserManagement /></AppLayout></ProtectedRoute>} />
      <Route path="/master-data" element={<ProtectedRoute roles={['SUPER_ADMIN']}><AppLayout><MasterData /></AppLayout></ProtectedRoute>} />
      <Route path="/export" element={<ProtectedRoute roles={['SUPER_ADMIN','SA']}><AppLayout><ExportExcel /></AppLayout></ProtectedRoute>} />
      <Route path="/activity-log" element={<ProtectedRoute roles={['SUPER_ADMIN']}><AppLayout><ActivityLog /></AppLayout></ProtectedRoute>} />
      <Route path="/partman-tasks" element={<ProtectedRoute roles={['SUPER_ADMIN','PARTMAN']}><AppLayout><PartmanTasks /></AppLayout></ProtectedRoute>} />
      <Route path="/sa-tasks" element={<ProtectedRoute roles={['SUPER_ADMIN','SA']}><AppLayout><SATasks /></AppLayout></ProtectedRoute>} />
      <Route path="/foreman-validation" element={<ProtectedRoute roles={['SUPER_ADMIN','FOREMAN']}><AppLayout><ForemanValidation /></AppLayout></ProtectedRoute>} />
      <Route path="/mra-tasks" element={<ProtectedRoute roles={['SUPER_ADMIN','MRA']}><AppLayout><MRATasks /></AppLayout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
