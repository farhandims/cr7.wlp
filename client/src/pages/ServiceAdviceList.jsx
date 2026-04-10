import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Badge from '../components/Badge';
import { Search, Plus, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ServiceAdviceList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [page, status]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15, status };
      if (search) params.search = search;
      const res = await api.get('/service-advice', { params });
      setData(res.data.data);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const formatRp = (val) => val ? `Rp ${Number(val).toLocaleString('id-ID')}` : '-';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Data Saran Service</h1>
          <p className="subtitle">{total} dokumen ditemukan</p>
        </div>
        {(user.roleCode === 'SUPER_ADMIN' || user.roleCode === 'TEKNISI' || user.roleCode === 'SA') && (
          <button className="btn btn-primary" onClick={() => navigate('/service-advice/new')}>
            <Plus size={18} /> Input Baru
          </button>
        )}
      </div>

      <div className="filters-bar">
        <form onSubmit={handleSearch} className="search-input">
          <Search size={18} />
          <input className="form-control" placeholder="Cari No Polisi, VIN, atau No Dokumen..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </form>
        <select className="form-control" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Semua Status</option>
          <option value="DRAFT">Draft</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="WAITING_FOLLOWUP">Waiting Follow Up</option>
          <option value="FOLLOWUP_ONGOING">Follow Up Ongoing</option>
          <option value="PARTIALLY_CLOSED">Partially Closed</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>No Dokumen</th>
              <th>Tanggal</th>
              <th>No Polisi</th>
              <th>Model</th>
              <th>Teknisi</th>
              <th>SA</th>
              <th>Item</th>
              <th>Outstanding</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="10" className="text-center" style={{padding: 40}}><div className="spinner" style={{margin:'0 auto'}} /></td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan="10" className="table-empty">Tidak ada data ditemukan</td></tr>
            ) : data.map(row => (
              <tr key={row.id} style={{cursor:'pointer'}} onClick={() => navigate(`/service-advice/${row.id}`)}>
                <td className="td-nowrap font-semibold" style={{color:'var(--primary)'}}>{row.nomor_dokumen}</td>
                <td className="td-nowrap">{row.tanggal_input?.split(' ')[0]}</td>
                <td className="font-semibold">{row.no_polisi}</td>
                <td>{row.model}</td>
                <td>{row.nama_teknisi}</td>
                <td>{row.nama_sa}</td>
                <td className="text-center">{row.total_items} <span className="text-muted text-sm">({row.total_parts}P/{row.total_jasa}J)</span></td>
                <td className="td-nowrap font-semibold" style={{color: row.total_outstanding > 0 ? 'var(--danger)' : 'var(--success)'}}>{formatRp(row.total_outstanding)}</td>
                <td><Badge status={row.status_header} /></td>
                <td><button className="btn btn-ghost btn-sm"><Eye size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <span>Halaman {page} dari {totalPages} ({total} data)</span>
          <div className="pagination-pages">
            <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p-1)}><ChevronLeft size={16} /></button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              if (p > totalPages) return null;
              return <button key={p} className={`pagination-btn ${p===page?'active':''}`} onClick={() => setPage(p)}>{p}</button>;
            })}
            <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => p+1)}><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
