import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Badge from '../components/Badge';
import { Search, Car, FileText, Download } from 'lucide-react';

function formatRp(v) { return v ? 'Rp ' + Number(v).toLocaleString('id-ID') : 'Rp 0'; }

export default function VehicleHistory() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (query.length < 2) return;
    setLoading(true);
    try {
      const res = await api.get(`/vehicles/search?q=${query}`);
      setResults(res.data);
      setSelected(null); setHistory(null);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadHistory = async (id) => {
    setLoading(true);
    try {
      const res = await api.get(`/vehicles/${id}/history`);
      setHistory(res.data);
      setSelected(res.data.vehicle);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleExportPdf = async (vehicleId) => {
    setExporting(true);
    try {
      const res = await api.get(`/export/pdf/${vehicleId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Summary_${selected?.no_polisi || 'vehicle'}_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { console.error('PDF export error:', err); }
    finally { setExporting(false); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Histori Kendaraan</h1><p className="subtitle">Cari berdasarkan No Polisi atau No Rangka/VIN</p></div>
      </div>

      <form onSubmit={handleSearch} className="filters-bar">
        <div className="search-input" style={{flex:1}}>
          <Search size={18} />
          <input className="form-control" placeholder="Ketik No Polisi, VIN, atau Model..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit">Cari</button>
      </form>

      {!selected && results.length > 0 && (
        <div className="card mb-4">
          <div className="card-header"><h3>Hasil Pencarian ({results.length})</h3></div>
          <div className="table-container" style={{border:'none'}}>
            <table><thead><tr><th>No Polisi</th><th>No Rangka</th><th>Model</th><th>Jumlah SA</th><th></th></tr></thead>
              <tbody>{results.map(v => (
                <tr key={v.id} style={{cursor:'pointer'}} onClick={() => loadHistory(v.id)}>
                  <td className="font-semibold">{v.no_polisi}</td><td>{v.no_rangka}</td><td>{v.model}</td>
                  <td>{v.total_sa} dokumen</td><td><button className="btn btn-ghost btn-sm">Lihat Histori</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {selected && history && (
        <>
          <div className="card mb-4">
            <div className="card-header">
              <h3><Car size={20} /> {selected.no_polisi} — {selected.model}</h3>
              <button className="btn btn-primary btn-sm" onClick={() => handleExportPdf(selected.id)} disabled={exporting}>
                <Download size={16} /> {exporting ? 'Exporting...' : 'Export PDF'}
              </button>
            </div>
            <div className="card-body">
              <div className="form-row">
                <div><span className="detail-label">No Rangka: </span><strong>{selected.no_rangka}</strong></div>
                <div><span className="detail-label">Total Dokumen: </span><strong>{history.headers.length}</strong></div>
                <div><span className="detail-label">Grand Outstanding: </span><strong style={{color:'var(--danger)'}}>{formatRp(history.grandOutstanding)}</strong></div>
              </div>
            </div>
          </div>

          {history.headers.map(h => (
            <div className="card mb-4" key={h.id} style={{cursor:'pointer'}} onClick={() => navigate(`/service-advice/${h.id}`)}>
              <div className="card-header">
                <div className="flex items-center gap-3">
                  <FileText size={18} style={{color:'var(--primary)'}} />
                  <div>
                    <strong style={{color:'var(--primary)'}}>{h.nomor_dokumen}</strong>
                    <div className="text-sm text-muted">{h.tanggal_input?.split(' ')[0]} — {h.nama_teknisi}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {h.outstanding > 0 && <span className="text-sm font-semibold" style={{color:'var(--danger)'}}>{formatRp(h.outstanding)}</span>}
                  <Badge status={h.status_header} />
                </div>
              </div>
              <div className="card-body">
                <table style={{fontSize:'0.85rem'}}>
                  <thead><tr><th>Tipe</th><th>Item</th><th>Harga</th><th>Status</th></tr></thead>
                  <tbody>{h.items.map(item => (
                    <tr key={item.id}>
                      <td><Badge status={item.item_type} /></td>
                      <td>{item.item_name}</td>
                      <td>{item.item_type === 'PART' ? formatRp(item.harga_part * (item.qty||1)) : formatRp(item.harga_jasa)}</td>
                      <td><Badge status={item.item_status} /></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}

      {!loading && results.length === 0 && query && (
        <div className="card"><div className="card-body text-center text-muted" style={{padding:48}}>
          <Car size={48} style={{opacity:0.2, marginBottom:12}} /><div>Tidak ada kendaraan ditemukan</div>
        </div></div>
      )}
    </div>
  );
}
