import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { ArrowLeft, CheckCircle, Clock, Upload, Send, Edit, Plus, Trash2, AlertTriangle } from 'lucide-react';

function formatRp(v) { return v ? 'Rp ' + Number(v).toLocaleString('id-ID') : 'Rp 0'; }

export default function ServiceAdviceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [modalData, setModalData] = useState({});
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [kategoriList, setKategoriList] = useState([]);
  const [addItems, setAddItems] = useState([{ item_type:'PART', item_name:'', item_description:'', qty:1, kategori_id:'' }]);

  const load = async () => {
    try {
      const res = await api.get(`/service-advice/${id}`);
      setDetail(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    api.get('/master/kategori?active=1').then(r => setKategoriList(r.data)).catch(() => {});
  }, [id]);

  // Part name autocomplete
  const searchParts = async (q) => {
    if (q.length < 2) { setPartSuggestions([]); return; }
    try {
      const res = await api.get(`/items/part-suggestions?q=${q}`);
      setPartSuggestions(res.data);
    } catch { setPartSuggestions([]); }
  };

  const handlePartUpdate = async (itemId) => {
    try {
      await api.put(`/items/${itemId}/part-info`, { ...modalData, no_part: (modalData.no_part || '').toUpperCase(), item_name: (modalData.item_name || '').toUpperCase() });
      setToast({ message: 'Data part berhasil dilengkapi.', type: 'success' });
      setModal(null); setModalData({}); setPartSuggestions([]); load();
    } catch (err) { setToast({ message: err.response?.data?.error || 'Gagal', type: 'error' }); }
  };

  const handlePriceUpdate = async (itemId) => {
    try {
      await api.put(`/items/${itemId}/service-price`, { harga_jasa: parseFloat(modalData.harga_jasa) || 0 });
      setToast({ message: 'Harga jasa berhasil diisi.', type: 'success' });
      setModal(null); setModalData({}); load();
    } catch (err) { setToast({ message: err.response?.data?.error || 'Gagal', type: 'error' }); }
  };

  const handleEditItem = async (itemId) => {
    try {
      await api.put(`/items/${itemId}/edit`, modalData);
      setToast({ message: 'Item berhasil diperbarui.', type: 'success' });
      setModal(null); setModalData({}); load();
    } catch (err) { setToast({ message: err.response?.data?.error || 'Gagal', type: 'error' }); }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await api.delete(`/items/${itemId}`);
      setToast({ message: 'Item berhasil dihapus.', type: 'success' });
      setModal(null); load();
    } catch (err) { setToast({ message: err.response?.data?.error || 'Gagal', type: 'error' }); }
  };

  const handleStatusUpdate = async (itemId, newStatus) => {
    try {
      await api.put(`/items/${itemId}/status`, { item_status: newStatus, customer_decision: newStatus });
      setToast({ message: 'Status berhasil diperbarui.', type: 'success' }); load();
    } catch (err) { setToast({ message: err.response?.data?.error || 'Gagal', type: 'error' }); }
  };

  const handleReplacement = async (itemId) => {
    try {
      await api.put(`/items/${itemId}/replacement`, modalData);
      setToast({ message: 'Status penggantian berhasil.', type: 'success' });
      setModal(null); setModalData({}); load();
    } catch (err) { setToast({ message: err.response?.data?.error || 'Gagal', type: 'error' }); }
  };

  const handleFollowUp = async (itemId) => {
    try {
      await api.post('/follow-ups', { item_id: itemId, ...modalData });
      setToast({ message: 'Follow up berhasil dicatat.', type: 'success' });
      setModal(null); setModalData({}); load();
    } catch (err) { setToast({ message: err.response?.data?.error || 'Gagal', type: 'error' }); }
  };

  const handleEditFollowUp = async (fuId) => {
    try {
      await api.put(`/follow-ups/${fuId}`, modalData);
      setToast({ message: 'Follow up berhasil diperbarui.', type: 'success' });
      setModal(null); setModalData({}); load();
    } catch (err) { setToast({ message: err.response?.data?.error || 'Gagal', type: 'error' }); }
  };

  const handleValidate = async () => {
    try {
      const foreman = (await api.get('/master/foreman?active=1')).data;
      await api.put(`/service-advice/${id}/validate`, { foreman_id: foreman[0]?.id, validation_note: modalData.validation_note });
      setToast({ message: 'Validasi berhasil.', type: 'success' });
      setModal(null); setModalData({}); load();
    } catch (err) { setToast({ message: err.response?.data?.error || 'Gagal', type: 'error' }); }
  };

  const handleSubmitDraft = async () => {
    try {
      await api.put(`/service-advice/${id}/submit`);
      setToast({ message: 'Data berhasil disubmit.', type: 'success' }); load();
    } catch (err) { setToast({ message: err.response?.data?.error || 'Gagal', type: 'error' }); }
  };

  const handleAddItems = async () => {
    const validItems = addItems.filter(i => i.item_name);
    if (validItems.length === 0) return setToast({ message: 'Minimal 1 item harus diisi.', type: 'error' });
    try {
      await api.post(`/service-advice/${id}/add-items`, { items: validItems });
      setToast({ message: `${validItems.length} item berhasil ditambahkan.`, type: 'success' });
      setModal(null);
      setAddItems([{ item_type:'PART', item_name:'', item_description:'', qty:1, kategori_id:'' }]);
      load();
    } catch (err) { setToast({ message: err.response?.data?.error || 'Gagal', type: 'error' }); }
  };

  const handleFileUpload = async (itemId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf,.doc,.docx';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entity_type', 'FOLLOW_UP_PROOF');
      fd.append('entity_id', itemId);
      try {
        await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setToast({ message: 'File berhasil diupload.', type: 'success' }); load();
      } catch (err) { setToast({ message: 'Upload gagal.', type: 'error' }); }
    };
    input.click();
  };

  if (loading) return <div className="page-container"><div className="loading-spinner"><div className="spinner" /></div></div>;
  if (!detail) return <div className="page-container"><p>Data tidak ditemukan.</p></div>;

  const { header: h, items, activityLogs, totals } = detail;
  const canEdit = ['SUPER_ADMIN', 'SA'].includes(user.roleCode);
  const isPartman = user.roleCode === 'PARTMAN' || user.roleCode === 'SUPER_ADMIN';
  const isSA = user.roleCode === 'SA' || user.roleCode === 'SUPER_ADMIN';
  const isForeman = user.roleCode === 'FOREMAN' || user.roleCode === 'SUPER_ADMIN';
  const canReplace = ['SA', 'TEKNISI', 'SUPER_ADMIN'].includes(user.roleCode);
  const canAddItems = ['SA', 'SUPER_ADMIN', 'TEKNISI'].includes(user.roleCode);
  const canDelete = user.roleCode === 'SUPER_ADMIN';

  return (
    <div className="page-container">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
          <div>
            <h1>{h.nomor_dokumen}</h1>
            <p className="subtitle">{h.no_polisi} — {h.model}</p>
          </div>
        </div>
        <div className="btn-group">
          <Badge status={h.status_header} />
          {h.status_header === 'DRAFT' && (user.roleCode === 'TEKNISI' || user.roleCode === 'SA' || user.roleCode === 'SUPER_ADMIN') && (
            <button className="btn btn-primary btn-sm" onClick={handleSubmitDraft}><Send size={16} /> Submit</button>
          )}
          {isForeman && !h.foreman_validated && h.status_header !== 'DRAFT' && (
            <button className="btn btn-success btn-sm" onClick={() => { setModal('validate'); setModalData({}); }}>
              <CheckCircle size={16} /> Validasi
            </button>
          )}
          {canAddItems && h.status_header !== 'DRAFT' && (
            <button className="btn btn-secondary btn-sm" onClick={() => {
              setModal('addItems');
              setAddItems([{ item_type:'PART', item_name:'', item_description:'', qty:1, kategori_id:'' }]);
            }}><Plus size={16} /> Tambah Item</button>
          )}
        </div>
      </div>

      {/* Vehicle & Header Info */}
      <div className="detail-grid">
        <div className="card">
          <div className="card-header"><h3>Info Kendaraan</h3></div>
          <div className="card-body">
            <div className="detail-row"><span className="detail-label">No Polisi</span><span className="detail-value">{h.no_polisi}</span></div>
            <div className="detail-row"><span className="detail-label">No Rangka</span><span className="detail-value">{h.no_rangka}</span></div>
            <div className="detail-row"><span className="detail-label">Model</span><span className="detail-value">{h.model}</span></div>
            <div className="detail-row"><span className="detail-label">Teknisi</span><span className="detail-value">{h.nama_teknisi}</span></div>
            <div className="detail-row"><span className="detail-label">SA</span><span className="detail-value">{h.nama_sa}</span></div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Info Dokumen</h3></div>
          <div className="card-body">
            <div className="detail-row"><span className="detail-label">Tanggal Input</span><span className="detail-value">{h.tanggal_input}</span></div>
            <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value"><Badge status={h.status_header} /></span></div>
            <div className="detail-row"><span className="detail-label">Foreman</span><span className="detail-value">{h.foreman_validated ? `✅ ${h.nama_foreman || 'Validated'}` : '⏳ Belum'}</span></div>
            <div className="detail-row"><span className="detail-label">Dibuat oleh</span><span className="detail-value">{h.created_by_name}</span></div>
            {h.note && <div className="detail-row"><span className="detail-label">Catatan</span><span className="detail-value">{h.note}</span></div>}
          </div>
        </div>
      </div>

      {/* Outstanding Box */}
      <div className="outstanding-box">
        <div className="outstanding-grid">
          <div className="outstanding-item"><div className="label">Outstanding Part</div><div className="value">{formatRp(totals.outstandingPart)}</div></div>
          <div className="outstanding-item"><div className="label">Outstanding Jasa</div><div className="value">{formatRp(totals.outstandingJasa)}</div></div>
          <div className="outstanding-item"><div className="label">Grand Total</div><div className="value grand">{formatRp(totals.grandTotal)}</div></div>
        </div>
      </div>

      {/* Items Table */}
      <div className="card mb-6">
        <div className="card-header"><h3>Daftar Item Saran ({items.length})</h3></div>
        <div className="table-container" style={{border:'none'}}>
          <table>
            <thead><tr><th>#</th><th>Tipe</th><th>Nama Item</th><th>Kategori</th><th>Qty</th><th>No Part</th><th>Harga</th><th>Stok</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id}>
                  <td>{i+1}</td>
                  <td><Badge status={item.item_type} /></td>
                  <td><strong>{item.item_name}</strong>{item.item_description && <div className="text-sm text-muted">{item.item_description}</div>}</td>
                  <td className="text-sm">{item.nama_kategori || '-'}</td>
                  <td>{item.qty}</td>
                  <td>{item.no_part || '-'}</td>
                  <td className="td-nowrap">{item.item_type === 'PART' ? formatRp(item.harga_part * (item.qty || 1)) : formatRp(item.harga_jasa)}</td>
                  <td>{item.part_availability || '-'}</td>
                  <td><Badge status={item.item_status} /></td>
                  <td>
                    <div className="btn-group">
                      {/* Edit button for SA/SUPER_ADMIN */}
                      {canEdit && (
                        <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => {
                          setModal({ type:'edit', itemId: item.id, itemType: item.item_type });
                          setModalData({
                            item_type: item.item_type,
                            item_name: item.item_name,
                            no_part: item.no_part || '',
                            harga: item.item_type === 'PART' ? (item.harga_part || '') : (item.harga_jasa || ''),
                            kategori_id: item.kategori_id || '',
                          });
                        }}><Edit size={14} /></button>
                      )}
                      {canDelete && (
                        <button className="btn btn-ghost btn-sm" title="Hapus" style={{color:'var(--danger)'}} onClick={() => {
                          setModal({ type:'confirmDelete', itemId: item.id, itemName: item.item_name });
                        }}><Trash2 size={14} /></button>
                      )}
                      {isPartman && item.item_type === 'PART' && item.item_status === 'WAITING_PARTMAN' && (
                        <button className="btn btn-primary btn-sm" onClick={() => { setModal({ type:'part', itemId: item.id }); setModalData({ item_name: item.item_name || '', no_part: item.no_part || '', harga_part: item.harga_part || '', part_availability: 'Ready' }); }}>Lengkapi</button>
                      )}
                      {isSA && item.item_type === 'JASA' && item.item_status === 'WAITING_SA_PRICING' && (
                        <button className="btn btn-primary btn-sm" onClick={() => { setModal({ type:'price', itemId: item.id }); setModalData({ harga_jasa: item.harga_jasa || '' }); }}>Isi Harga</button>
                      )}
                      {isSA && ['READY_FOLLOWUP','FOLLOWED_UP','WAITING_DECISION'].includes(item.item_status) && (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setModal({ type:'followup', itemId: item.id }); setModalData({ follow_up_date: new Date().toISOString().split('T')[0] }); }}>Follow Up</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleFileUpload(item.id)}><Upload size={14} /></button>
                        </>
                      )}
                      {isSA && item.item_status === 'FOLLOWED_UP' && (
                        <div className="btn-group">
                          <button className="btn btn-success btn-sm" onClick={() => handleStatusUpdate(item.id, 'APPROVED')}>Approved</button>
                          <button className="btn btn-warning btn-sm" onClick={() => handleStatusUpdate(item.id, 'DEFERRED')}>Deferred</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleStatusUpdate(item.id, 'REJECTED')}>Rejected</button>
                        </div>
                      )}
                      {canReplace && ['APPROVED','FOLLOWED_UP','WAITING_DECISION','DEFERRED'].includes(item.item_status) && (
                        <button className="btn btn-success btn-sm" onClick={() => { setModal({ type:'replace', itemId: item.id }); setModalData({ replacement_status:'REPLACED' }); }}>Tandai Ganti</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Follow Up & Reminder History per item */}
      {items.filter(i => i.follow_ups?.length > 0 || i.reminders?.length > 0 || i.attachments?.length > 0).map(item => (
        <div className="card mb-4" key={`hist-${item.id}`}>
          <div className="card-header"><h3>Histori: {item.item_name}</h3></div>
          <div className="card-body">
            {item.follow_ups?.length > 0 && (<>
              <h3 className="mb-2" style={{fontSize:'0.9rem'}}>📞 Follow Up</h3>
              <div className="timeline mb-4">
                {item.follow_ups.map(fu => (
                  <div className="timeline-item" key={fu.id}>
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <strong>{fu.follow_up_by_name}</strong> — {fu.follow_up_result || 'No result'}
                      {fu.note && <div className="text-sm text-muted">{fu.note}</div>}
                    </div>
                    <div className="timeline-time" style={{display:'flex', alignItems:'center', gap:8}}>
                      <span>{fu.follow_up_date}{fu.next_follow_up_date && ` → Next: ${fu.next_follow_up_date}`}</span>
                      {isSA && (
                        <button className="btn btn-ghost btn-sm" title="Edit Follow Up" style={{padding:'2px 6px', minHeight:'auto'}} onClick={() => {
                          setModal({ type:'editFollowUp', fuId: fu.id, itemId: item.id });
                          setModalData({
                            follow_up_date: fu.follow_up_date || '',
                            follow_up_result: fu.follow_up_result || '',
                            next_follow_up_date: fu.next_follow_up_date || '',
                            note: fu.note || '',
                            item_status: item.item_status || ''
                          });
                        }}><Edit size={12} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>)}
            {item.reminders?.length > 0 && (<>
              <h3 className="mb-2" style={{fontSize:'0.9rem'}}>🔔 Reminder</h3>
              <div className="timeline">
                {item.reminders.map(r => (
                  <div className="timeline-item" key={r.id}>
                    <div className="timeline-dot" style={{background:'var(--accent)'}} />
                    <div className="timeline-content"><strong>{r.reminder_by_name}</strong> — {r.reminder_result || '-'}</div>
                    <div className="timeline-time">{r.reminder_date}</div>
                  </div>
                ))}
              </div>
            </>)}
            {item.attachments?.length > 0 && (<>
              <h3 className="mb-2 mt-4" style={{fontSize:'0.9rem'}}>📎 Lampiran</h3>
              {item.attachments.map(a => (
                <div key={a.id} className="text-sm mb-2">
                  <a href={`/${a.file_path}`} target="_blank" rel="noreferrer">{a.file_name}</a>
                  <span className="text-muted"> — oleh {a.uploaded_by_name}</span>
                </div>
              ))}
            </>)}
          </div>
        </div>
      ))}

      {/* Activity Log */}
      {activityLogs?.length > 0 && (
        <div className="card">
          <div className="card-header"><h3>Activity Log</h3></div>
          <div className="card-body">
            <div className="timeline">
              {activityLogs.slice(0, 20).map(log => (
                <div className="timeline-item" key={log.id}>
                  <div className="timeline-dot" style={{background:'var(--text-muted)', width:12, height:12, left:-21, top:6}} />
                  <div className="timeline-content text-sm">{log.description} <span className="text-muted">— {log.action_by_name}</span></div>
                  <div className="timeline-time">{log.action_at}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === MODALS === */}

      {/* Part Info Modal */}
      <Modal show={modal?.type === 'part'} onClose={() => { setModal(null); setPartSuggestions([]); }} title="Lengkapi Data Part"
        footer={<><button className="btn btn-secondary" onClick={() => { setModal(null); setPartSuggestions([]); }}>Batal</button><button className="btn btn-primary" onClick={() => handlePartUpdate(modal.itemId)}>Simpan</button></>}>
        <div className="form-group">
          <label className="form-label">Nama Part</label>
          <input className="form-control" style={{textTransform:'uppercase'}} value={modalData.item_name || ''} onChange={e => setModalData({...modalData, item_name: e.target.value.toUpperCase()})} placeholder="Nama part (bisa dikoreksi jika typo)" />
        </div>
        <div className="form-group">
          <label className="form-label">No Part</label>
          <input className="form-control" style={{textTransform:'uppercase'}} value={modalData.no_part || ''} onChange={e => {
            const v = e.target.value.toUpperCase();
            setModalData({...modalData, no_part: v});
            searchParts(v);
          }} placeholder="Ketik untuk pencarian otomatis..." />
          {partSuggestions.length > 0 && (
            <div style={{border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', marginTop:4, maxHeight:150, overflowY:'auto', background:'white'}}>
              {partSuggestions.map((s, i) => (
                <div key={i} style={{padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid var(--border-light)', fontSize:'0.85rem'}}
                  onClick={() => { setModalData({...modalData, no_part: s.no_part, harga_part: s.harga_part}); setPartSuggestions([]); }}>
                  <strong>{s.no_part}</strong> — {s.item_name} <span className="text-muted">({formatRp(s.harga_part)})</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="form-group"><label className="form-label">Harga Part (Rp)</label><input className="form-control" type="number" min="0" value={modalData.harga_part || ''} onChange={e => setModalData({...modalData, harga_part: e.target.value})} /></div>
        <div className="form-group"><label className="form-label">Ketersediaan</label>
          <select className="form-control" value={modalData.part_availability || ''} onChange={e => setModalData({...modalData, part_availability: e.target.value})}>
            <option value="Ready">Ready</option><option value="Stok Depo">Stok Depo</option><option value="Stok TAM">Stok TAM</option><option value="Tidak ada stok">Tidak ada stok</option>
          </select>
        </div>
      </Modal>

      {/* Price Modal */}
      <Modal show={modal?.type === 'price'} onClose={() => setModal(null)} title="Isi Harga Jasa"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Batal</button><button className="btn btn-primary" onClick={() => handlePriceUpdate(modal.itemId)}>Simpan</button></>}>
        <div className="form-group"><label className="form-label">Harga Jasa (Rp)</label><input className="form-control" type="number" min="0" value={modalData.harga_jasa || ''} onChange={e => setModalData({...modalData, harga_jasa: e.target.value})} /></div>
      </Modal>

      {/* Edit Item Modal */}
      <Modal show={modal?.type === 'edit'} onClose={() => setModal(null)} title="Edit Item (Koreksi)"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Batal</button><button className="btn btn-primary" onClick={() => handleEditItem(modal.itemId)}>Simpan</button></>}>
        <div className="form-group"><label className="form-label">Tipe (Part/Jasa)</label>
          <select className="form-control" value={modalData.item_type || 'PART'} onChange={e => setModalData({...modalData, item_type: e.target.value})}>
            <option value="PART">Part</option><option value="JASA">Jasa</option>
          </select></div>
        <div className="form-group"><label className="form-label">Nama Item</label><input className="form-control" style={{textTransform:'uppercase'}} value={modalData.item_name || ''} onChange={e => setModalData({...modalData, item_name: e.target.value.toUpperCase()})} /></div>
        {(modalData.item_type || modal?.itemType) === 'PART' && (
          <div className="form-group"><label className="form-label">No Part</label><input className="form-control" style={{textTransform:'uppercase'}} value={modalData.no_part || ''} onChange={e => setModalData({...modalData, no_part: e.target.value.toUpperCase()})} /></div>
        )}
        <div className="form-group"><label className="form-label">Kategori</label>
          <select className="form-control" value={modalData.kategori_id || ''} onChange={e => setModalData({...modalData, kategori_id: e.target.value || null})}>
            <option value="">-- Tanpa Kategori --</option>
            {kategoriList.map(k => <option key={k.id} value={k.id}>{k.nama_kategori}</option>)}
          </select></div>
        <div className="form-group"><label className="form-label">Harga (Rp)</label><input className="form-control" type="number" min="0" value={modalData.harga || ''} onChange={e => setModalData({...modalData, harga: e.target.value})} /></div>
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal show={modal?.type === 'confirmDelete'} onClose={() => setModal(null)} title="Hapus Item"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Batal</button><button className="btn btn-danger" onClick={() => handleDeleteItem(modal.itemId)}>Ya, Hapus</button></>}>
        <div style={{textAlign:'center', padding:'8px 0'}}>
          <AlertTriangle size={48} style={{color:'var(--danger)', marginBottom:12}} />
          <p style={{fontWeight:600, fontSize:'1rem'}}>Hapus item ini?</p>
          <p className="text-muted text-sm">Item <strong>"{modal?.itemName}"</strong> akan dihapus permanen.</p>
          <p className="text-muted text-sm">Aksi ini tidak bisa dibatalkan.</p>
        </div>
      </Modal>

      {/* Follow Up Modal */}
      <Modal show={modal?.type === 'followup'} onClose={() => setModal(null)} title="Catat Follow Up"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Batal</button><button className="btn btn-primary" onClick={() => handleFollowUp(modal.itemId)}>Simpan</button></>}>
        <div className="form-group"><label className="form-label">Tanggal Follow Up</label><input className="form-control" type="date" value={modalData.follow_up_date || ''} onChange={e => setModalData({...modalData, follow_up_date: e.target.value})} /></div>
        <div className="form-group"><label className="form-label">Hasil Follow Up</label><textarea className="form-control" value={modalData.follow_up_result || ''} onChange={e => setModalData({...modalData, follow_up_result: e.target.value})} placeholder="Tulis hasil follow up..." /></div>
        <div className="form-group"><label className="form-label">Next Follow Up</label><input className="form-control" type="date" value={modalData.next_follow_up_date || ''} onChange={e => setModalData({...modalData, next_follow_up_date: e.target.value})} /></div>
        <div className="form-group"><label className="form-label">Catatan</label><input className="form-control" value={modalData.note || ''} onChange={e => setModalData({...modalData, note: e.target.value})} /></div>
      </Modal>

      {/* Replacement Modal */}
      <Modal show={modal?.type === 'replace'} onClose={() => setModal(null)} title="Tandai Penggantian"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Batal</button><button className="btn btn-success" onClick={() => handleReplacement(modal.itemId)}>Konfirmasi</button></>}>
        <div className="form-group"><label className="form-label">Status Penggantian</label>
          <select className="form-control" value={modalData.replacement_status || ''} onChange={e => setModalData({...modalData, replacement_status: e.target.value})}>
            <option value="REPLACED">Sudah Diganti (Dealer Ini)</option><option value="REPLACED_OTHER">Diganti di Dealer Lain</option><option value="REPLACED_NONORI">Diganti di Luar (Non Ori)</option>
          </select>
        </div>
        <div className="form-group"><label className="form-label">Catatan</label><input className="form-control" value={modalData.replacement_note || ''} onChange={e => setModalData({...modalData, replacement_note: e.target.value})} /></div>
      </Modal>

      {/* Edit Follow Up Modal */}
      <Modal show={modal?.type === 'editFollowUp'} onClose={() => setModal(null)} title="Edit Follow Up"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Batal</button><button className="btn btn-primary" onClick={() => handleEditFollowUp(modal.fuId)}>Simpan</button></>}>
        <div className="form-group"><label className="form-label">Status Item</label>
          <select className="form-control" value={modalData.item_status || ''} onChange={e => setModalData({...modalData, item_status: e.target.value})}>
            <option value="FOLLOWED_UP">Followed Up</option>
            <option value="WAITING_DECISION">Waiting Decision</option>
            <option value="APPROVED">Approved</option>
            <option value="DEFERRED">Deferred</option>
            <option value="REJECTED">Rejected</option>
            <option value="READY_FOLLOWUP">Ready Follow Up</option>
          </select>
        </div>
        <div className="form-group"><label className="form-label">Tanggal Follow Up</label><input className="form-control" type="date" value={modalData.follow_up_date || ''} onChange={e => setModalData({...modalData, follow_up_date: e.target.value})} /></div>
        <div className="form-group"><label className="form-label">Hasil Follow Up</label><textarea className="form-control" value={modalData.follow_up_result || ''} onChange={e => setModalData({...modalData, follow_up_result: e.target.value})} placeholder="Tulis hasil follow up..." /></div>
        <div className="form-group"><label className="form-label">Next Follow Up</label><input className="form-control" type="date" value={modalData.next_follow_up_date || ''} onChange={e => setModalData({...modalData, next_follow_up_date: e.target.value})} /></div>
        <div className="form-group"><label className="form-label">Catatan</label><input className="form-control" value={modalData.note || ''} onChange={e => setModalData({...modalData, note: e.target.value})} /></div>
      </Modal>

      {/* Validation Modal */}
      <Modal show={modal === 'validate'} onClose={() => setModal(null)} title="Validasi Foreman"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Batal</button><button className="btn btn-success" onClick={handleValidate}>Validasi</button></>}>
        <div className="form-group"><label className="form-label">Catatan Validasi</label><textarea className="form-control" value={modalData.validation_note || ''} onChange={e => setModalData({...modalData, validation_note: e.target.value})} placeholder="Catatan validasi (opsional)" /></div>
      </Modal>

      {/* Add Items Modal */}
      <Modal show={modal === 'addItems'} onClose={() => setModal(null)} title="Tambah Item Baru" size="lg"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Batal</button><button className="btn btn-primary" onClick={handleAddItems}>Tambah {addItems.filter(i=>i.item_name).length} Item</button></>}>
        {addItems.map((item, i) => (
          <div key={i} style={{display:'grid', gridTemplateColumns:'90px 1fr 1fr 60px 120px 30px', gap:8, marginBottom:8, alignItems:'start'}}>
            <select className="form-control" value={item.item_type} onChange={e => {
              const newItems = [...addItems]; newItems[i].item_type = e.target.value; setAddItems(newItems);
            }} style={{padding:'8px',fontSize:'0.82rem'}}>
              <option value="PART">Part</option><option value="JASA">Jasa</option>
            </select>
            <input className="form-control" placeholder="Nama item" value={item.item_name} onChange={e => {
              const newItems = [...addItems]; newItems[i].item_name = e.target.value.toUpperCase(); setAddItems(newItems);
            }} style={{padding:'8px',fontSize:'0.82rem',textTransform:'uppercase'}} />
            <input className="form-control" placeholder="Deskripsi" value={item.item_description} onChange={e => {
              const newItems = [...addItems]; newItems[i].item_description = e.target.value; setAddItems(newItems);
            }} style={{padding:'8px',fontSize:'0.82rem'}} />
            <input className="form-control" type="number" min="1" value={item.qty} onChange={e => {
              const newItems = [...addItems]; newItems[i].qty = parseInt(e.target.value) || 1; setAddItems(newItems);
            }} style={{padding:'8px',fontSize:'0.82rem'}} />
            <select className="form-control" value={item.kategori_id} onChange={e => {
              const newItems = [...addItems]; newItems[i].kategori_id = e.target.value; setAddItems(newItems);
            }} style={{padding:'8px',fontSize:'0.82rem'}}>
              <option value="">Kategori</option>
              {kategoriList.map(k => <option key={k.id} value={k.id}>{k.nama_kategori}</option>)}
            </select>
            <button className="btn-remove-item" onClick={() => addItems.length > 1 && setAddItems(addItems.filter((_,idx) => idx !== i))} disabled={addItems.length<=1} style={{marginTop:4}}><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={() => setAddItems([...addItems, { item_type:'PART', item_name:'', item_description:'', qty:1, kategori_id:'' }])} style={{marginTop:8}}>
          <Plus size={14} /> Tambah Baris
        </button>
      </Modal>
    </div>
  );
}
