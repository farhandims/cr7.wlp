import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { Package, Search } from 'lucide-react';

function formatRp(v) { return v ? 'Rp ' + Number(v).toLocaleString('id-ID') : '-'; }

export default function PartmanTasks() {
  const navigate = useNavigate();
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [toast, setToast] = useState(null);
  const [filterNopol, setFilterNopol] = useState('');
  const [filterStatus, setFilterStatus] = useState('WAITING_PARTMAN');
  const [partSuggestions, setPartSuggestions] = useState([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get('/service-advice', { params: { status: '', limit: 200 } });
      const items = [];
      for (const h of res.data.data) {
        const detail = await api.get(`/service-advice/${h.id}`);
        detail.data.items.filter(i => i.item_type === 'PART').forEach(i => {
          items.push({ ...i, nomor_dokumen: h.nomor_dokumen, no_polisi: h.no_polisi, model: h.model, header_id: h.id });
        });
      }
      setAllItems(items);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const searchParts = async (q) => {
    if (q.length < 2) { setPartSuggestions([]); return; }
    try {
      const res = await api.get(`/items/part-suggestions?q=${q}`);
      setPartSuggestions(res.data);
    } catch { setPartSuggestions([]); }
  };

  const handleSave = async () => {
    try {
      await api.put(`/items/${modal}/part-info`, { ...form, no_part: (form.no_part || '').toUpperCase(), item_name: (form.item_name || '').toUpperCase() });
      setToast({ message: 'Data part berhasil dilengkapi!', type: 'success' });
      setModal(null); setForm({}); setPartSuggestions([]); load();
    } catch (err) { setToast({ message: err.response?.data?.error || 'Gagal', type: 'error' }); }
  };

  const filtered = allItems.filter(item => {
    if (filterStatus && item.item_status !== filterStatus) return false;
    if (filterNopol && !item.no_polisi?.toUpperCase().includes(filterNopol.toUpperCase())) return false;
    return true;
  });

  if (loading) return <div className="page-container"><div className="loading-spinner"><div className="spinner" /></div></div>;

  return (
    <div className="page-container">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="page-header">
        <div><h1><Package size={24} style={{marginRight:8}} />Tugas Partman</h1>
          <p className="subtitle">{filtered.length} item ditampilkan</p></div>
      </div>

      <div className="filters-bar">
        <div className="search-input">
          <Search size={18} />
          <input className="form-control" placeholder="Filter No Polisi..." value={filterNopol} onChange={e => setFilterNopol(e.target.value)} />
        </div>
        <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Semua Status</option>
          <option value="WAITING_PARTMAN">Waiting Partman</option>
          <option value="READY_FOLLOWUP">Ready Follow Up</option>
          <option value="FOLLOWED_UP">Followed Up</option>
          <option value="APPROVED">Approved</option>
          <option value="REPLACED">Replaced</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card"><div className="card-body text-center text-muted" style={{padding:60}}>
          <Package size={48} style={{opacity:0.2, marginBottom:12}} /><div>Tidak ada data ditemukan</div>
        </div></div>
      ) : (
        <div className="table-container">
          <table><thead><tr><th>No Dokumen</th><th>No Polisi</th><th>Model</th><th>Nama Item</th><th>Qty</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>{filtered.map(item => (
              <tr key={item.id}>
                <td className="font-semibold" style={{color:'var(--primary)', cursor:'pointer'}} onClick={() => navigate(`/service-advice/${item.header_id}`)}>{item.nomor_dokumen}</td>
                <td className="font-semibold">{item.no_polisi}</td><td>{item.model}</td>
                <td><strong>{item.item_name}</strong>{item.item_description && <div className="text-sm text-muted">{item.item_description}</div>}</td>
                <td>{item.qty}</td><td><Badge status={item.item_status} /></td>
                <td>
                  {item.item_status === 'WAITING_PARTMAN' && (
                    <button className="btn btn-primary btn-sm" onClick={() => { setModal(item.id); setForm({ item_name: item.item_name || '', no_part:'', harga_part:'', part_availability:'Ready' }); }}>Lengkapi</button>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <Modal show={!!modal} onClose={() => { setModal(null); setPartSuggestions([]); }} title="Lengkapi Data Part"
        footer={<><button className="btn btn-secondary" onClick={() => { setModal(null); setPartSuggestions([]); }}>Batal</button><button className="btn btn-primary" onClick={handleSave}>Simpan</button></>}>
        <div className="form-group">
          <label className="form-label">Nama Part</label>
          <input className="form-control" style={{textTransform:'uppercase'}} value={form.item_name||''} onChange={e => setForm({...form, item_name: e.target.value.toUpperCase()})} placeholder="Nama part (bisa dikoreksi jika typo)" />
        </div>
        <div className="form-group">
          <label className="form-label">No Part</label>
          <input className="form-control" style={{textTransform:'uppercase'}} value={form.no_part||''} onChange={e => {
            const v = e.target.value.toUpperCase();
            setForm({...form, no_part: v});
            searchParts(v);
          }} placeholder="Ketik untuk pencarian otomatis..." />
          {partSuggestions.length > 0 && (
            <div style={{border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', marginTop:4, maxHeight:150, overflowY:'auto', background:'white'}}>
              {partSuggestions.map((s, i) => (
                <div key={i} style={{padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid var(--border-light)', fontSize:'0.85rem'}}
                  onClick={() => { setForm({...form, no_part: s.no_part, harga_part: s.harga_part}); setPartSuggestions([]); }}>
                  <strong>{s.no_part}</strong> — {s.item_name} <span className="text-muted">({formatRp(s.harga_part)})</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="form-group"><label className="form-label">Harga Part (Rp)</label><input className="form-control" type="number" min="0" value={form.harga_part||''} onChange={e => setForm({...form, harga_part: e.target.value})} /></div>
        <div className="form-group"><label className="form-label">Ketersediaan</label>
          <select className="form-control" value={form.part_availability||''} onChange={e => setForm({...form, part_availability: e.target.value})}>
            <option value="Ready">Ready</option><option value="Stok Depo">Stok Depo</option><option value="Stok TAM">Stok TAM</option><option value="Tidak ada stok">Tidak ada stok</option>
          </select></div>
      </Modal>
    </div>
  );
}
