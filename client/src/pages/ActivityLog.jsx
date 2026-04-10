import { useState, useEffect } from 'react';
import api from '../services/api';
import { Activity, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ entity_type: '', date_from: '', date_to: '' });

  useEffect(() => { load(); }, [page]);

  const load = async () => {
    const params = { page, limit: 30, ...filters };
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
    const res = await api.get('/activity-logs', { params });
    setLogs(res.data.data); setTotal(res.data.total); setTotalPages(res.data.totalPages);
  };

  const actionColors = { CREATE: 'var(--success)', UPDATE: 'var(--primary)', STATUS_CHANGE: 'var(--warning)', DELETE: 'var(--danger)', LOGIN: 'var(--info)', FOLLOW_UP: 'var(--accent)', REMINDER: 'var(--accent)', UPLOAD: 'var(--info)', VALIDATION: 'var(--success)', PART_UPDATE: 'var(--primary)', PRICE_UPDATE: 'var(--primary)', REPLACEMENT: 'var(--success)' };

  return (
    <div className="page-container">
      <div className="page-header"><div><h1>Activity Log</h1><p className="subtitle">{total} aktivitas tercatat</p></div></div>

      <div className="filters-bar">
        <select className="form-control" value={filters.entity_type} onChange={e => setFilters({...filters, entity_type: e.target.value})}>
          <option value="">Semua Tipe</option>
          <option value="AUTH">Login</option><option value="SERVICE_ADVICE">Saran Service</option>
          <option value="ITEM">Item</option><option value="USER">User</option><option value="ATTACHMENT">File</option>
        </select>
        <input className="form-control" type="date" value={filters.date_from} onChange={e => setFilters({...filters, date_from: e.target.value})} />
        <input className="form-control" type="date" value={filters.date_to} onChange={e => setFilters({...filters, date_to: e.target.value})} />
        <button className="btn btn-primary btn-sm" onClick={() => { setPage(1); load(); }}>Filter</button>
      </div>

      <div className="card">
        <div className="card-body">
          {logs.length === 0 ? <div className="text-center text-muted" style={{padding:40}}>Tidak ada log</div> : (
            <div className="timeline">
              {logs.map(log => (
                <div className="timeline-item" key={log.id}>
                  <div className="timeline-dot" style={{ background: actionColors[log.action_type] || 'var(--text-muted)', width: 14, height: 14, left: -22, top: 5 }} />
                  <div className="timeline-content">
                    <span className="badge" style={{ background: (actionColors[log.action_type] || 'gray') + '20', color: actionColors[log.action_type], fontSize: '0.7rem', marginRight: 8 }}>{log.action_type}</span>
                    <span>{log.description || `${log.entity_type} #${log.entity_id}`}</span>
                    <span className="text-muted text-sm"> — {log.action_by_name || log.username}</span>
                    {log.old_value && log.new_value && <div className="text-sm text-muted mt-1">{log.old_value} → {log.new_value}</div>}
                  </div>
                  <div className="timeline-time">{log.action_at}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <span>Halaman {page} dari {totalPages}</span>
          <div className="pagination-pages">
            <button className="pagination-btn" disabled={page<=1} onClick={() => setPage(p=>p-1)}><ChevronLeft size={16}/></button>
            <button className="pagination-btn" disabled={page>=totalPages} onClick={() => setPage(p=>p+1)}><ChevronRight size={16}/></button>
          </div>
        </div>
      )}
    </div>
  );
}
