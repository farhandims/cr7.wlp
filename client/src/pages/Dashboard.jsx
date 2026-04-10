import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Badge from '../components/Badge';
import { Car, FileText, Package, Wrench, AlertCircle, CheckCircle, Clock, TrendingUp, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#3b82f6','#ef4444','#f59e0b','#10b981','#8b5cf6','#06b6d4','#ec4899','#14b8a6'];

function formatRp(val) {
  if (!val) return 'Rp 0';
  return 'Rp ' + Number(val).toLocaleString('id-ID');
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [operational, setOperational] = useState(null);
  const [saPerf, setSaPerf] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sumRes, opsRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/operational'),
      ]);
      setSummary(sumRes.data);
      setOperational(opsRes.data);
      if (user.roleCode === 'SUPER_ADMIN' || user.roleCode === 'SA') {
        const saRes = await api.get('/dashboard/sa-performance');
        setSaPerf(saRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page-container"><div className="loading-spinner"><div className="spinner" /></div></div>;

  const stats = summary || {};
  const ops = operational || {};

  const pieData = (stats.statusDistribution || []).map(s => ({
    name: s.status_header, value: s.count
  }));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">Selamat datang, {user.fullName}!</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Car size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">Total Kendaraan</div>
            <div className="stat-value">{stats.totalVehicles || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><FileText size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">Total Dokumen</div>
            <div className="stat-value">{stats.totalHeaders || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon cyan"><Package size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">Item Part</div>
            <div className="stat-value">{stats.total_parts || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><Wrench size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">Item Jasa</div>
            <div className="stat-value">{stats.total_jasa || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><AlertCircle size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">Item Outstanding</div>
            <div className="stat-value">{stats.total_outstanding || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">Sudah Diganti</div>
            <div className="stat-value">{stats.total_replaced || 0}</div>
          </div>
        </div>
      </div>

      {/* Outstanding Value */}
      {(user.roleCode === 'SUPER_ADMIN' || user.roleCode === 'SA') && (
        <div className="outstanding-box">
          <h3 style={{ marginBottom: 16 }}>💰 Total Nilai Outstanding</h3>
          <div className="outstanding-grid">
            <div className="outstanding-item">
              <div className="label">Outstanding</div>
              <div className="value grand">{formatRp(stats.outstanding_value)}</div>
            </div>
            <div className="outstanding-item">
              <div className="label">Belum Follow Up</div>
              <div className="value">{stats.total_not_followed || 0} item</div>
            </div>
            <div className="outstanding-item">
              <div className="label">Ganti di Dealer Lain</div>
              <div className="value">{stats.total_replaced_other || 0} item</div>
            </div>
          </div>
        </div>
      )}

      {/* Operational Stats */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon red"><Package size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">Tugas Partman Pending</div>
            <div className="stat-value">{ops.partmanPending || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><Clock size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">Tugas SA Pending</div>
            <div className="stat-value">{ops.saPending || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><TrendingUp size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">Perlu Follow Up</div>
            <div className="stat-value">{ops.needFollowUp || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><AlertCircle size={24} /></div>
          <div className="stat-info">
            <div className="stat-label">Perlu Reminder</div>
            <div className="stat-value">{ops.needReminder || 0}</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid-2">
        {pieData.length > 0 && (
          <div className="card">
            <div className="card-header"><h3>Distribusi Status Dokumen</h3></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${value}`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {saPerf.length > 0 && (
          <div className="card">
            <div className="card-header"><h3>Performance SA</h3></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={saPerf}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="nama_sa" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total_items" name="Total Item" fill="#3b82f6" radius={[4,4,0,0]} />
                  <Bar dataKey="total_closed" name="Closed" fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="total_outstanding" name="Outstanding" fill="#f59e0b" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
