import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { Bell, Search } from 'lucide-react';

export default function MRATasks() {
  const navigate = useNavigate();
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [toast, setToast] = useState(null);
  const [filterNopol, setFilterNopol] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get('/reminders/pending');
      setAllItems(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleReminder = async () => {
    try {
      await api.post('/reminders', { item_id: modal, ...form });
      setToast({ message: 'Reminder berhasil dicatat!', type: 'success' });
      setModal(null); setForm({}); load();
    } catch (err) { setToast({ message: err.response?.data?.error || 'Gagal', type: 'error' }); }
  };

  const filtered = allItems.filter(item => {
    if (filterNopol && !item.no_polisi?.toUpperCase().includes(filterNopol.toUpperCase())) return false;
    if (filterStatus && item.item_status !== filterStatus) return false;
    return true;
  });

  if (loading) return <div className="page-container"><div className="loading-spinner"><div className="spinner" /></div></div>;

  return (
    <div className="page-container">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="page-header">
        <div><h1><Bell size={24} style={{marginRight:8}} />Tugas Reminder MRA</h1>
          <p className="subtitle">{filtered.length} item ditampilkan</p></div>
      </div>

      <div className="filters-bar">
        <div className="search-input">
          <Search size={18} />
          <input className="form-control" placeholder="Filter No Polisi..." value={filterNopol} onChange={e => setFilterNopol(e.target.value)} />
        </div>
        <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Semua Status</option>
          <option value="FOLLOWED_UP">Followed Up</option>
          <option value="WAITING_DECISION">Waiting Decision</option>
          <option value="APPROVED">Approved</option>
          <option value="DEFERRED">Deferred</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card"><div className="card-body text-center text-muted" style={{padding:60}}>
          <Bell size={48} style={{opacity:0.2, marginBottom:12}} /><div>Tidak ada item ditemukan</div>
        </div></div>
      ) : (
        <div className="table-container">
          <table><thead><tr><th>No Dokumen</th><th>No Polisi</th><th>Model</th><th>SA</th><th>Nama Item</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>{filtered.map(item => (
              <tr key={item.id}>
                <td className="font-semibold" style={{color:'var(--primary)', cursor:'pointer'}} onClick={() => navigate(`/service-advice/${item.header_id || item.id}`)}>{item.nomor_dokumen}</td>
                <td className="font-semibold">{item.no_polisi}</td><td>{item.model}</td>
                <td>{item.nama_sa}</td>
                <td><strong>{item.item_name}</strong></td>
                <td><Badge status={item.item_status} /></td>
                <td><button className="btn btn-primary btn-sm" onClick={() => { setModal(item.id); setForm({ reminder_date: new Date().toISOString().split('T')[0] }); }}><Bell size={14} /> Reminder</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <Modal show={!!modal} onClose={() => setModal(null)} title="Catat Reminder"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Batal</button><button className="btn btn-primary" onClick={handleReminder}>Simpan</button></>}>
        <div className="form-group"><label className="form-label">Tanggal Reminder <span className="required">*</span></label><input className="form-control" type="date" value={form.reminder_date||''} onChange={e => setForm({...form, reminder_date: e.target.value})} /></div>
        <div className="form-group"><label className="form-label">Hasil Reminder</label><textarea className="form-control" rows="3" value={form.reminder_result||''} onChange={e => setForm({...form, reminder_result: e.target.value})} placeholder="Tulis hasil reminder ke customer..." /></div>
        <div className="form-group"><label className="form-label">Tanggal Reminder Berikutnya</label><input className="form-control" type="date" value={form.next_reminder_date||''} onChange={e => setForm({...form, next_reminder_date: e.target.value})} /></div>
        <div className="form-group"><label className="form-label">Catatan</label><input className="form-control" value={form.note||''} onChange={e => setForm({...form, note: e.target.value})} /></div>
      </Modal>
    </div>
  );
}
