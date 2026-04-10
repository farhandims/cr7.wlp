import { useState, useEffect } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { Plus, Edit, UserCheck, UserX } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ username:'', password:'', full_name:'', role_id:'' });
  const [toast, setToast] = useState(null);

  useEffect(() => { load(); loadRoles(); }, []);

  const load = async () => {
    const res = await api.get('/users');
    setUsers(res.data);
  };
  const loadRoles = async () => {
    const res = await api.get('/users/roles');
    setRoles(res.data);
  };

  const openNew = () => { setEditing(null); setForm({ username:'', password:'', full_name:'', role_id:'' }); setModal(true); };
  const openEdit = (u) => { setEditing(u); setForm({ username: u.username, password:'', full_name: u.full_name, role_id: u.role_id }); setModal(true); };

  const handleSave = async () => {
    try {
      if (editing) {
        const data = { ...form };
        if (!data.password) delete data.password;
        await api.put(`/users/${editing.id}`, data);
        setToast({ message: 'User berhasil diperbarui.', type: 'success' });
      } else {
        if (!form.username || !form.password || !form.full_name || !form.role_id) return setToast({ message: 'Semua field wajib diisi.', type: 'error' });
        await api.post('/users', form);
        setToast({ message: 'User berhasil dibuat.', type: 'success' });
      }
      setModal(false); load();
    } catch (err) { setToast({ message: err.response?.data?.error || 'Gagal', type: 'error' }); }
  };

  const toggleActive = async (u) => {
    try {
      await api.patch(`/users/${u.id}/toggle-active`);
      setToast({ message: `User ${u.is_active ? 'dinonaktifkan' : 'diaktifkan'}.`, type: 'success' }); load();
    } catch (err) { setToast({ message: err.response?.data?.error || 'Gagal', type: 'error' }); }
  };

  return (
    <div className="page-container">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="page-header">
        <div><h1>User Management</h1><p className="subtitle">Kelola akun pengguna sistem</p></div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={18} /> Tambah User</button>
      </div>

      <div className="table-container">
        <table>
          <thead><tr><th>Username</th><th>Nama Lengkap</th><th>Role</th><th>Status</th><th>Dibuat</th><th>Aksi</th></tr></thead>
          <tbody>{users.map(u => (
            <tr key={u.id}>
              <td className="font-semibold">{u.username}</td>
              <td>{u.full_name}</td>
              <td><span className="badge badge-open">{u.role_name}</span></td>
              <td>{u.is_active ? <span className="badge badge-closed"><span className="badge-dot"/>Aktif</span> : <span className="badge badge-draft"><span className="badge-dot"/>Nonaktif</span>}</td>
              <td className="text-sm text-muted">{u.created_at?.split(' ')[0]}</td>
              <td>
                <div className="btn-group">
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}><Edit size={14} /> Edit</button>
                  <button className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleActive(u)}>
                    {u.is_active ? <><UserX size={14} /> Nonaktifkan</> : <><UserCheck size={14} /> Aktifkan</>}
                  </button>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <Modal show={modal} onClose={() => setModal(false)} title={editing ? 'Edit User' : 'Tambah User Baru'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Batal</button><button className="btn btn-primary" onClick={handleSave}>Simpan</button></>}>
        <div className="form-group"><label className="form-label">Username <span className="required">*</span></label>
          <input className="form-control" value={form.username} onChange={e => setForm({...form, username: e.target.value})} /></div>
        <div className="form-group"><label className="form-label">Password {editing ? '(kosongkan jika tidak diubah)' : <span className="required">*</span>}</label>
          <input className="form-control" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} /></div>
        <div className="form-group"><label className="form-label">Nama Lengkap <span className="required">*</span></label>
          <input className="form-control" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} /></div>
        <div className="form-group"><label className="form-label">Role <span className="required">*</span></label>
          <select className="form-control" value={form.role_id} onChange={e => setForm({...form, role_id: e.target.value})}>
            <option value="">-- Pilih Role --</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.role_name}</option>)}
          </select></div>
      </Modal>
    </div>
  );
}
