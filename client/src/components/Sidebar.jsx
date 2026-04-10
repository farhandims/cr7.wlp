import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, FileText, Car, Users, Settings, Download, Activity,
  Wrench, ClipboardCheck, Package, Phone, Bell, LogOut, Menu, X, PlusCircle
} from 'lucide-react';

const menuConfig = {
  SUPER_ADMIN: [
    { section: 'Dashboard', items: [
      { icon: LayoutDashboard, label: 'Dashboard Utama', path: '/' },
    ]},
    { section: 'Data', items: [
      { icon: PlusCircle, label: 'Input Saran Service', path: '/service-advice/new' },
      { icon: FileText, label: 'Saran Service', path: '/service-advice' },
      { icon: Car, label: 'Histori Kendaraan', path: '/vehicles' },
    ]},
    { section: 'Operasional', items: [
      { icon: Package, label: 'Tugas Partman', path: '/partman-tasks' },
      { icon: Phone, label: 'Tugas SA', path: '/sa-tasks' },
      { icon: ClipboardCheck, label: 'Validasi Foreman', path: '/foreman-validation' },
      { icon: Bell, label: 'Tugas MRA', path: '/mra-tasks' },
    ]},
    { section: 'Pengaturan', items: [
      { icon: Users, label: 'User Management', path: '/users' },
      { icon: Settings, label: 'Master Data', path: '/master-data' },
      { icon: Download, label: 'Export Excel', path: '/export' },
      { icon: Activity, label: 'Activity Log', path: '/activity-log' },
    ]},
  ],
  TEKNISI: [
    { section: 'Menu', items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
      { icon: PlusCircle, label: 'Input Saran Service', path: '/service-advice/new' },
      { icon: FileText, label: 'Data Saran Service', path: '/service-advice' },
      { icon: Car, label: 'Histori Kendaraan', path: '/vehicles' },
    ]},
  ],
  FOREMAN: [
    { section: 'Menu', items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
      { icon: ClipboardCheck, label: 'Validasi', path: '/foreman-validation' },
      { icon: FileText, label: 'Data Saran Service', path: '/service-advice' },
      { icon: Car, label: 'Histori Kendaraan', path: '/vehicles' },
    ]},
  ],
  PARTMAN: [
    { section: 'Menu', items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
      { icon: Package, label: 'Tugas Saya', path: '/partman-tasks' },
      { icon: FileText, label: 'Data Saran Service', path: '/service-advice' },
      { icon: Car, label: 'Histori Kendaraan', path: '/vehicles' },
    ]},
  ],
  SA: [
    { section: 'Menu', items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
      { icon: PlusCircle, label: 'Input Saran Service', path: '/service-advice/new' },
      { icon: Phone, label: 'Tugas Follow Up', path: '/sa-tasks' },
      { icon: FileText, label: 'Data Saran Service', path: '/service-advice' },
      { icon: Car, label: 'Histori Kendaraan', path: '/vehicles' },
      { icon: Download, label: 'Export Excel', path: '/export' },
    ]},
  ],
  MRA: [
    { section: 'Menu', items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
      { icon: Bell, label: 'Tugas Reminder', path: '/mra-tasks' },
      { icon: FileText, label: 'Data Saran Service', path: '/service-advice' },
      { icon: Car, label: 'Histori Kendaraan', path: '/vehicles' },
    ]},
  ],
};

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;
  const menus = menuConfig[user.roleCode] || [];

  const handleNav = (path) => {
    navigate(path);
    onClose?.();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user.fullName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <>
      {open && <div className="mobile-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/logo.png" alt="Logo" style={{ width: 42, height: 42, borderRadius: 'var(--radius)', objectFit: 'contain', flexShrink: 0, background: 'white', padding: 2 }} />
          <div>
            <h2>Wijaya Toyota</h2>
            <small>CR7 Web App</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menus.map((section, si) => (
            <div className="sidebar-section" key={si}>
              <div className="sidebar-section-title">{section.section}</div>
              {section.items.map((item, ii) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <button
                    key={ii}
                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                    onClick={() => handleNav(item.path)}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="name">{user.fullName}</div>
              <div className="role">{user.roleName}</div>
            </div>
            <button className="btn-logout" onClick={handleLogout} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
