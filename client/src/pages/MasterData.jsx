import { useState, useEffect } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { Plus, Edit, Wrench, Users, Shield, Tag, Building2 } from 'lucide-react';

export default function MasterData() {
  const [tab, setTab] = useState('teknisi');
  const [data, setData] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [toast, setToast] = useState(null);
  const [saUsers, setSaUsers] = useState([]);

  useEffect(() => { load(); }, [tab]);

  const load = async () => {
    const res = await api.get(`/master/${tab}`);
    setData(res.data);
    if (tab === 'sa' || tab === 'foreman') {
      const uRes = await api.get('/users');
      setSaUsers(uRes.data.filter(u => tab === 'sa' ? u.role_code === 'SA' : u.role_code === 'FOREMAN'));
    }
  };

  const getNameField = () => {
    if (tab === 'teknisi') return 'nama_teknisi';
    if (tab === 'sa') return 'nama_sa';
    if (tab === 'foreman') return 'nama_foreman';
    if (tab === 'kategori') return 'nama_kategori';
    if (tab === 'cabang') return 'nama_cabang';
    return '';
  };
  const nameField = getNameField();
  const label = tab === 'teknisi' ? 'Teknisi' : tab === 'sa' ? 'Service Advisor' : tab === 'foreman' ? 'Foreman' : tab === 'kategori' ? 'Kategori Service' : 'Cabang';

  const openNew = () => { setEditing(null); setForm({}); setModal(true); };
  const openEdit = (item) => {
    const f = { [nameField]: item[nameField], is_active: item.is_active };
    if (tab === 'sa' || tab === 'foreman') f.user_id = item.user_id;
    if (tab === 'cabang') { f.alamat = item.alamat; f.telepon = item.telepon; }
    setEditing(item); setForm(f); setModal(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await api.put(`/master/${tab}/${editing.id}`, form);
      } else {
        await api.post(`/master/${tab}`, form);
      }
      setToast({ message: `${label} berhasil ${editing ? 'diperbarui' : 'ditambahkan'}.`, type: 'success' });
      setModal(false); load();
    } catch (err) { setToast({ message: err.response?.data?.error || 'Gagal', type: 'error' }); }
  };

  return (
    <div className="page-container">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="page-header">
        <div><h1>Master Data</h1><p className="subtitle">Kelola data master sistem</p></div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={18} /> Tambah {label}</button>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab==='teknisi'?'active':''}`} onClick={() => setTab('teknisi')}><Wrench size={16} style={{marginRight:6}} />Teknisi</button>
        <button className={`tab-btn ${tab==='sa'?'active':''}`} onClick={() => setTab('sa')}><Users size={16} style={{marginRight:6}} />Service Advisor</button>
        <button className={`tab-btn ${tab==='foreman'?'active':''}`} onClick={() => setTab('foreman')}><Shield size={16} style={{marginRight:6}} />Foreman</button>
        <button className={`tab-btn ${tab==='kategori'?'active':''}`} onClick={() => setTab('kategori')}><Tag size={16} style={{marginRight:6}} />Kategori Service</button>
        <button className={`tab-btn ${tab==='cabang'?'active':''}`} onClick={() => setTab('cabang')}><Building2 size={16} style={{marginRight:6}} />Cabang</button>
      </div>

      <div className="table-container">
        <table>
          <thead><tr>
            <th>ID</th><th>Nama</th>
            {tab === 'cabang' && <th>Alamat</th>}
            {tab === 'cabang' && <th>Telepon</th>}
            {(tab === 'sa' || tab === 'foreman') && <th>User Login</th>}
            <th>Status</th><th>Aksi</th>
          </tr></thead>
          <tbody>{data.map(item => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td className="font-semibold">{item[nameField]}</td>
              {tab === 'cabang' && <td>{item.alamat || <span className="text-muted">-</span>}</td>}
              {tab === 'cabang' && <td>{item.telepon || <span className="text-muted">-</span>}</td>}
              {(tab === 'sa' || tab === 'foreman') && <td>{item.username || <span className="text-muted">-</span>}</td>}
              <td>{item.is_active ? <span className="badge badge-closed"><span className="badge-dot"/>Aktif</span> : <span className="badge badge-draft"><span className="badge-dot"/>Nonaktif</span>}</td>
              <td><button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}><Edit size={14} /> Edit</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <Modal show={modal} onClose={() => setModal(false)} title={`${editing ? 'Edit' : 'Tambah'} ${label}`}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Batal</button><button className="btn btn-primary" onClick={handleSave}>Simpan</button></>}>
        <div className="form-group"><label className="form-label">Nama {label} <span className="required">*</span></label>
          <input className="form-control" value={form[nameField] || ''} onChange={e => setForm({...form, [nameField]: e.target.value})}
            style={tab === 'kategori' ? {textTransform:'uppercase'} : {}} /></div>
        {tab === 'cabang' && (
          <>
            <div className="form-group"><label className="form-label">Alamat</label>
              <input className="form-control" value={form.alamat || ''} onChange={e => setForm({...form, alamat: e.target.value})} placeholder="Alamat cabang" /></div>
            <div className="form-group"><label className="form-label">Telepon</label>
              <input className="form-control" value={form.telepon || ''} onChange={e => setForm({...form, telepon: e.target.value})} placeholder="No telepon cabang" /></div>
          </>
        )}
        {(tab === 'sa' || tab === 'foreman') && (
          <div className="form-group"><label className="form-label">Terhubung ke User Login</label>
            <select className="form-control" value={form.user_id || ''} onChange={e => setForm({...form, user_id: e.target.value || null})}>
              <option value="">-- Tidak ada --</option>
              {saUsers.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.username})</option>)}
            </select></div>
        )}
        {editing && (
          <div className="form-group"><label className="form-label">Status</label>
            <select className="form-control" value={form.is_active !== undefined ? form.is_active : 1} onChange={e => setForm({...form, is_active: parseInt(e.target.value)})}>
              <option value={1}>Aktif</option><option value={0}>Nonaktif</option>
            </select></div>
        )}
      </Modal>
    </div>
  );
}
