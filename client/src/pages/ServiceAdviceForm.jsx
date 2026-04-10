import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { Plus, Trash2, Save, Send, AlertTriangle } from 'lucide-react';

export default function ServiceAdviceForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ no_polisi:'', no_rangka:'', model:'', teknisi_id:'', sa_id:'', note:'' });
  const [items, setItems] = useState([{ item_type:'PART', item_name:'', item_description:'', qty:1, kategori_id:'' }]);
  const [teknisiList, setTeknisiList] = useState([]);
  const [saList, setSaList] = useState([]);
  const [kategoriList, setKategoriList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [existingVehicle, setExistingVehicle] = useState(null);
  const [vinError, setVinError] = useState('');
  const [confirmModal, setConfirmModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  useEffect(() => {
    api.get('/master/teknisi?active=1').then(r => setTeknisiList(r.data));
    api.get('/master/sa?active=1').then(r => setSaList(r.data));
    api.get('/master/kategori?active=1').then(r => setKategoriList(r.data));
  }, []);

  // Autofill by No Polisi
  const handleNopolBlur = async () => {
    const nopol = form.no_polisi.replace(/\s/g, '');
    if (nopol.length >= 3) {
      try {
        const res = await api.get(`/vehicles/search?q=${nopol}`);
        if (res.data.length > 0) {
          const v = res.data[0];
          if (v.no_polisi.replace(/\s/g, '').toUpperCase() === nopol.toUpperCase()) {
            setForm(f => ({ ...f, no_rangka: v.no_rangka, model: v.model }));
            setExistingVehicle(v);
            setVinError('');
          }
        }
      } catch {}
    }
  };

  // Autofill by VIN
  const handleVINBlur = async () => {
    const vin = form.no_rangka.replace(/\s/g, '');
    if (vin.length >= 5) {
      try {
        const res = await api.get(`/vehicles/search?q=${vin}`);
        if (res.data.length > 0) {
          const v = res.data[0];
          setForm(f => ({ ...f, no_polisi: v.no_polisi.replace(/\s/g, ''), model: v.model }));
          setExistingVehicle(v);
        }
      } catch {}
    }
  };

  // Validate No Rangka
  const validateVIN = (val) => {
    const clean = val.replace(/\s/g, '').toUpperCase();
    if (clean.length > 17) return 'Maksimal 17 karakter';
    if (/O/.test(clean)) return 'Huruf O tidak diizinkan (gunakan angka 0)';
    return '';
  };

  const handleNoRangkaChange = (val) => {
    const clean = val.replace(/\s/g, '').toUpperCase();
    setForm({...form, no_rangka: clean});
    setVinError(validateVIN(clean));
  };

  const handleNoPolisiChange = (val) => {
    const clean = val.replace(/\s/g, '').toUpperCase();
    setForm({...form, no_polisi: clean});
  };

  const addItem = () => setItems([...items, { item_type:'PART', item_name:'', item_description:'', qty:1, kategori_id:'' }]);
  const removeItem = (i) => items.length > 1 && setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setItems(items.map((item, idx) => idx === i ? {...item, [field]: val} : item));

  const getTeknisiName = () => teknisiList.find(t => String(t.id) === String(form.teknisi_id))?.nama_teknisi || '-';
  const getSAName = () => saList.find(s => String(s.id) === String(form.sa_id))?.nama_sa || '-';

  const handleSubmitClick = (submit) => {
    if (!form.no_polisi || !form.no_rangka || !form.model) return setToast({ message: 'Data kendaraan wajib diisi lengkap.', type: 'error' });
    if (vinError) return setToast({ message: vinError, type: 'error' });
    if (!form.teknisi_id || !form.sa_id) return setToast({ message: 'Teknisi dan SA wajib dipilih.', type: 'error' });
    if (items.some(i => !i.item_name)) return setToast({ message: 'Semua nama item wajib diisi.', type: 'error' });

    if (submit) {
      setPendingSubmit(true);
      setConfirmModal(true);
    } else {
      doSubmit(false);
    }
  };

  const doSubmit = async (submit) => {
    setLoading(true);
    setConfirmModal(false);
    try {
      const res = await api.post('/service-advice', { ...form, items, submit });
      setToast({ message: `Data berhasil ${submit ? 'disubmit' : 'disimpan'}. No: ${res.data.nomor_dokumen}`, type: 'success' });
      setTimeout(() => navigate(`/service-advice/${res.data.id}`), 1500);
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Gagal menyimpan.', type: 'error' });
    } finally { setLoading(false); }
  };

  const partCount = items.filter(i => i.item_type === 'PART').length;
  const jasaCount = items.filter(i => i.item_type === 'JASA').length;

  return (
    <div className="page-container">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="page-header">
        <div>
          <h1>Input Saran Service Baru</h1>
          <p className="subtitle">Isi data kendaraan dan daftar saran service</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header"><h3>Data Kendaraan</h3></div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">No Polisi <span className="required">*</span></label>
              <input className="form-control" placeholder="Contoh: B1234ABC (tanpa spasi)" value={form.no_polisi}
                onChange={e => handleNoPolisiChange(e.target.value)} onBlur={handleNopolBlur}
                style={{textTransform:'uppercase'}} />
              {existingVehicle && <div className="form-hint" style={{color:'var(--success)'}}>✓ Kendaraan sudah terdaftar, data otomatis diisi</div>}
            </div>
            <div className="form-group">
              <label className="form-label">No Rangka / VIN <span className="required">*</span></label>
              <input className="form-control" placeholder="Max 17 karakter, tanpa huruf O" value={form.no_rangka}
                onChange={e => handleNoRangkaChange(e.target.value)} onBlur={handleVINBlur}
                maxLength={17} style={{textTransform:'uppercase'}} />
              {vinError && <div className="form-error">{vinError}</div>}
              <div className="form-hint">{form.no_rangka.length}/17 karakter</div>
            </div>
            <div className="form-group">
              <label className="form-label">Model Kendaraan <span className="required">*</span></label>
              <input className="form-control" placeholder="Contoh: Toyota Avanza" value={form.model}
                onChange={e => setForm({...form, model: e.target.value})} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nama Teknisi <span className="required">*</span></label>
              <select className="form-control" value={form.teknisi_id} onChange={e => setForm({...form, teknisi_id: e.target.value})}>
                <option value="">-- Pilih Teknisi --</option>
                {teknisiList.map(t => <option key={t.id} value={t.id}>{t.nama_teknisi}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">SA Penerima <span className="required">*</span></label>
              <select className="form-control" value={form.sa_id} onChange={e => setForm({...form, sa_id: e.target.value})}>
                <option value="">-- Pilih SA --</option>
                {saList.map(s => <option key={s.id} value={s.id}>{s.nama_sa}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Catatan</label>
              <input className="form-control" placeholder="Catatan tambahan (opsional)" value={form.note}
                onChange={e => setForm({...form, note: e.target.value})} />
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <h3>Daftar Saran Service</h3>
          <button className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={16} /> Tambah Item</button>
        </div>
        <div className="card-body">
          <div className="item-row-header" style={{display:'grid', gridTemplateColumns:'100px 1fr 1fr 70px 140px 36px', gap:10, fontWeight:600, fontSize:'0.8rem', color:'var(--text-secondary)', borderBottom:'2px solid var(--border)', paddingBottom:8, marginBottom:4}}>
            <div>Tipe</div><div>Nama Item</div><div>Deskripsi</div><div>Qty</div><div>Kategori</div><div></div>
          </div>
          {items.map((item, i) => (
            <div key={i} style={{display:'grid', gridTemplateColumns:'100px 1fr 1fr 70px 140px 36px', gap:10, alignItems:'start', padding:'10px 0', borderBottom:'1px solid var(--border-light)'}}>
              <select className="form-control" value={item.item_type} onChange={e => updateItem(i, 'item_type', e.target.value)} style={{padding:'8px 10px',fontSize:'0.85rem'}}>
                <option value="PART">Part</option>
                <option value="JASA">Jasa</option>
              </select>
              <input className="form-control" placeholder="Nama item saran" value={item.item_name}
                onChange={e => updateItem(i, 'item_name', e.target.value.toUpperCase())} style={{padding:'8px 10px',fontSize:'0.85rem',textTransform:'uppercase'}} />
              <input className="form-control" placeholder="Deskripsi / catatan" value={item.item_description}
                onChange={e => updateItem(i, 'item_description', e.target.value)} style={{padding:'8px 10px',fontSize:'0.85rem'}} />
              <input className="form-control" type="number" min="1" value={item.qty}
                onChange={e => updateItem(i, 'qty', parseInt(e.target.value) || 1)} style={{padding:'8px 10px',fontSize:'0.85rem'}} />
              <select className="form-control" value={item.kategori_id} onChange={e => updateItem(i, 'kategori_id', e.target.value)} style={{padding:'8px 10px',fontSize:'0.85rem'}}>
                <option value="">-- Kategori --</option>
                {kategoriList.map(k => <option key={k.id} value={k.id}>{k.nama_kategori}</option>)}
              </select>
              <button className="btn-remove-item" onClick={() => removeItem(i)} disabled={items.length <= 1}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="btn-group">
        <button className="btn btn-secondary" onClick={() => handleSubmitClick(false)} disabled={loading}>
          <Save size={18} /> Simpan Draft
        </button>
        <button className="btn btn-primary" onClick={() => handleSubmitClick(true)} disabled={loading}>
          <Send size={18} /> Submit & Proses
        </button>
      </div>

      {/* Confirmation Modal */}
      <Modal show={confirmModal} onClose={() => setConfirmModal(false)} title="Konfirmasi Submit"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setConfirmModal(false)}>Batal</button>
          <button className="btn btn-primary" onClick={() => doSubmit(true)} disabled={loading}>
            {loading ? 'Memproses...' : 'Ya, Submit'}
          </button>
        </>}>
        <div style={{textAlign:'center', marginBottom:16}}>
          <AlertTriangle size={48} style={{color:'var(--warning)', marginBottom:8}} />
          <p style={{fontWeight:600, fontSize:'1.05rem'}}>Apakah data sudah benar?</p>
          <p className="text-muted text-sm">Data yang disubmit akan langsung diproses ke Partman & SA.</p>
        </div>
        <div style={{background:'var(--bg)', borderRadius:'var(--radius)', padding:16}}>
          <div className="detail-row"><span className="detail-label">No Polisi</span><span className="detail-value font-semibold">{form.no_polisi}</span></div>
          <div className="detail-row"><span className="detail-label">No Rangka</span><span className="detail-value">{form.no_rangka}</span></div>
          <div className="detail-row"><span className="detail-label">Model</span><span className="detail-value">{form.model}</span></div>
          <div className="detail-row"><span className="detail-label">Teknisi</span><span className="detail-value">{getTeknisiName()}</span></div>
          <div className="detail-row"><span className="detail-label">SA</span><span className="detail-value">{getSAName()}</span></div>
          <div className="detail-row"><span className="detail-label">Jumlah Item</span><span className="detail-value">{items.length} ({partCount} Part, {jasaCount} Jasa)</span></div>
        </div>
      </Modal>
    </div>
  );
}
