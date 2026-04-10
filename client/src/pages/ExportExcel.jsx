import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Toast from '../components/Toast';
import { Download, Filter } from 'lucide-react';

export default function ExportExcel() {
  const { user } = useAuth();
  const [saList, setSaList] = useState([]);
  const [filters, setFilters] = useState({ date_from: '', date_to: '', sa_id: '', status: '' });
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get('/master/sa?active=1').then(r => setSaList(r.data)); }, []);

  const handleExport = async (type) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
      const res = await api.get(`/export/${type}?${params.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url;
      a.download = `${type === 'summary' ? 'Ringkasan' : 'Detail'}_SA_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click(); window.URL.revokeObjectURL(url);
      setToast({ message: 'Export berhasil!', type: 'success' });
    } catch (err) { setToast({ message: 'Export gagal.', type: 'error' }); }
    finally { setLoading(false); }
  };

  return (
    <div className="page-container">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="page-header"><div><h1>Export Excel</h1><p className="subtitle">Export data ke file Excel</p></div></div>

      <div className="card mb-6">
        <div className="card-header"><h3><Filter size={18} /> Filter Data</h3></div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group"><label className="form-label">Dari Tanggal</label>
              <input className="form-control" type="date" value={filters.date_from} onChange={e => setFilters({...filters, date_from: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Sampai Tanggal</label>
              <input className="form-control" type="date" value={filters.date_to} onChange={e => setFilters({...filters, date_to: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">SA</label>
              <select className="form-control" value={filters.sa_id} onChange={e => setFilters({...filters, sa_id: e.target.value})}>
                <option value="">Semua SA</option>{saList.map(s => <option key={s.id} value={s.id}>{s.nama_sa}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">Status</label>
              <select className="form-control" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
                <option value="">Semua Status</option>
                <option value="OPEN">Open</option><option value="IN_PROGRESS">In Progress</option>
                <option value="WAITING_FOLLOWUP">Waiting Follow Up</option><option value="FOLLOWUP_ONGOING">Follow Up Ongoing</option>
                <option value="PARTIALLY_CLOSED">Partially Closed</option><option value="CLOSED">Closed</option>
              </select></div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-body text-center" style={{padding: 40}}>
            <Download size={48} style={{color:'var(--primary)', marginBottom: 16}} />
            <h3 className="mb-2">Export Ringkasan</h3>
            <p className="text-sm text-muted mb-4">Data header dokumen: no polisi, teknisi, SA, status, total item, outstanding</p>
            <button className="btn btn-primary" onClick={() => handleExport('summary')} disabled={loading}>
              <Download size={18} /> Download Ringkasan
            </button>
          </div>
        </div>
        {user.roleCode === 'SUPER_ADMIN' && (
          <div className="card">
            <div className="card-body text-center" style={{padding: 40}}>
              <Download size={48} style={{color:'var(--secondary)', marginBottom: 16}} />
              <h3 className="mb-2">Export Detail Lengkap</h3>
              <p className="text-sm text-muted mb-4">Data per item: harga part, jasa, stok, follow up, reminder, status lengkap</p>
              <button className="btn btn-primary" onClick={() => handleExport('detail')} disabled={loading} style={{background:'var(--secondary)'}}>
                <Download size={18} /> Download Detail
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
