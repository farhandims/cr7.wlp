import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import { ClipboardCheck, Search } from 'lucide-react';

export default function ForemanValidation() {
  const navigate = useNavigate();
  const [allHeaders, setAllHeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [filterNopol, setFilterNopol] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get('/service-advice', { params: { limit: 200 } });
      setAllHeaders(res.data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleValidate = async (id) => {
    try {
      const foreman = (await api.get('/master/foreman?active=1')).data;
      await api.put(`/service-advice/${id}/validate`, { foreman_id: foreman[0]?.id, validation_note: 'Validated' });
      setToast({ message: 'Validasi berhasil!', type: 'success' }); load();
    } catch (err) { setToast({ message: err.response?.data?.error || 'Gagal', type: 'error' }); }
  };

  const filtered = allHeaders.filter(h => {
    if (h.status_header === 'DRAFT') return false;
    if (filterStatus === 'pending' && h.foreman_validated) return false;
    if (filterStatus === 'validated' && !h.foreman_validated) return false;
    if (filterNopol && !h.no_polisi?.toUpperCase().includes(filterNopol.toUpperCase())) return false;
    return true;
  });

  if (loading) return <div className="page-container"><div className="loading-spinner"><div className="spinner" /></div></div>;

  return (
    <div className="page-container">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="page-header">
        <div><h1><ClipboardCheck size={24} style={{marginRight:8}} />Validasi Foreman</h1>
          <p className="subtitle">{filtered.length} dokumen ditampilkan</p></div>
      </div>

      <div className="filters-bar">
        <div className="search-input">
          <Search size={18} />
          <input className="form-control" placeholder="Filter No Polisi..." value={filterNopol} onChange={e => setFilterNopol(e.target.value)} />
        </div>
        <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="pending">Belum Divalidasi</option>
          <option value="validated">Sudah Divalidasi</option>
          <option value="">Semua</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card"><div className="card-body text-center text-muted" style={{padding:60}}>
          <ClipboardCheck size={48} style={{opacity:0.2, marginBottom:12}} /><div>Tidak ada dokumen ditemukan</div>
        </div></div>
      ) : (
        <div className="table-container">
          <table><thead><tr><th>No Dokumen</th><th>Tanggal</th><th>No Polisi</th><th>Model</th><th>Teknisi</th><th>SA</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>{filtered.map(h => (
              <tr key={h.id}>
                <td className="font-semibold" style={{color:'var(--primary)', cursor:'pointer'}} onClick={() => navigate(`/service-advice/${h.id}`)}>{h.nomor_dokumen}</td>
                <td>{h.tanggal_input?.split(' ')[0]}</td>
                <td className="font-semibold">{h.no_polisi}</td><td>{h.model}</td>
                <td>{h.nama_teknisi}</td><td>{h.nama_sa}</td>
                <td><Badge status={h.status_header} /></td>
                <td>
                  <div className="btn-group">
                    {!h.foreman_validated && (
                      <button className="btn btn-success btn-sm" onClick={() => handleValidate(h.id)}><ClipboardCheck size={14} /> Validasi</button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/service-advice/${h.id}`)}>Detail</button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
