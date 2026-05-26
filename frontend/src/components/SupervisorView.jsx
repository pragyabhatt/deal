import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Search, Download, RefreshCw, FolderSearch, Filter, Calculator } from 'lucide-react';

const SupervisorView = () => {
  const { apiFetch } = useAuth();
  const [runs, setRuns] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search & Filter state
  const [usernameFilter, setUsernameFilter] = useState('');
  const [noiseFilter, setNoiseFilter] = useState('All');
  const [minSnr, setMinSnr] = useState('');
  const [maxSnr, setMaxSnr] = useState('');
  
  // Pagination
  const [limit, setLimit] = useState(15);
  const [page, setPage] = useState(1);

  const fetchRuns = async () => {
    setLoading(true);
    setError('');
    
    // Construct query parameters
    const params = new URLSearchParams();
    if (usernameFilter) params.append('analyst_username', usernameFilter);
    if (noiseFilter !== 'All') params.append('noise_type', noiseFilter.toLowerCase());
    if (minSnr !== '') params.append('min_snr', minSnr);
    if (maxSnr !== '') params.append('max_snr', maxSnr);
    
    params.append('limit', limit);
    params.append('offset', (page - 1) * limit);

    try {
      const res = await apiFetch(`/api/analysis/runs?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to query supervisor run records.');
      }
      const data = await res.json();
      setRuns(data.runs);
      setTotal(data.total);
    } catch (err) {
      setError(err.message || 'Audit history service unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [page, limit]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchRuns();
  };

  const resetFilters = () => {
    setUsernameFilter('');
    setNoiseFilter('All');
    setMinSnr('');
    setMaxSnr('');
    setPage(1);
    // Timeout to let state updates apply before refetch
    setTimeout(() => {
      fetchRuns();
    }, 50);
  };

  // Safe offline CSV Export utility
  const exportToCSV = () => {
    if (runs.length === 0) return;
    
    const headers = ["ID", "Analyst", "Clean File Name", "Noise Type", "Target SNR (dB)", "PESQ Score", "STOI Index", "Actual SNR (dB)", "Timestamp"];
    const rows = runs.map(r => [
      r.id,
      r.analyst_username,
      `"${r.clean_file_name}"`,
      r.noise_type,
      r.snr_db,
      r.pesq_score,
      r.stoi_score,
      r.final_snr,
      r.timestamp
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DEAL_Run_Audits_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Math aggregates calculations for stats panel
  const getAverageMetric = (key) => {
    if (runs.length === 0) return 0;
    const sum = runs.reduce((acc, curr) => acc + (curr[key] || 0), 0);
    return (sum / runs.length).toFixed(2);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Dynamic aggregate statistic summary bars */}
      <section className="grid-cols-3">
        <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', borderRadius: '12px' }}>
          <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(0, 255, 213, 0.05)', border: '1px solid rgba(0, 255, 213, 0.1)' }}>
            <FolderSearch size={22} color="var(--color-primary)" />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Sessions Audited
            </span>
            <div style={{ fontSize: '24px', fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--text-bright)' }}>{total}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', borderRadius: '12px' }}>
          <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
            <Calculator size={22} color="var(--color-secondary)" />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Average PESQ (Active Set)
            </span>
            <div style={{ fontSize: '24px', fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--color-primary)' }}>
              {getAverageMetric('pesq_score')}
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', borderRadius: '12px' }}>
          <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
            <Calculator size={22} color="var(--color-success)" />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Average STOI (Active Set)
            </span>
            <div style={{ fontSize: '24px', fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--color-success)' }}>
              {getAverageMetric('stoi_score')}
            </div>
          </div>
        </div>
      </section>

      {/* Filter and Search Panel */}
      <section className="glass-panel" style={{ padding: '24px', borderRadius: '12px' }}>
        <h4 style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
          <Filter size={16} color="var(--color-primary)" />
          Supervisor Audit Filters
        </h4>
        <form onSubmit={handleSearchSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: '12px', alignItems: 'end' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Analyst Username
            </label>
            <input
              type="text"
              value={usernameFilter}
              onChange={(e) => setUsernameFilter(e.target.value)}
              className="custom-input"
              style={{ padding: '8px 12px', fontSize: '13px' }}
              placeholder="Search Analyst..."
            />
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Noise Pattern
            </label>
            <select
              value={noiseFilter}
              onChange={(e) => setNoiseFilter(e.target.value)}
              className="custom-select"
              style={{ padding: '8px 12px', fontSize: '13px', backgroundPosition: 'right 8px center' }}
            >
              <option value="All">All Noises</option>
              <option value="White">White Noise</option>
              <option value="Pink">Pink Noise</option>
              <option value="Babble">Babble Noise</option>
              <option value="Factory">Factory Noise</option>
            </select>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Min SNR Target (dB)
            </label>
            <input
              type="number"
              value={minSnr}
              onChange={(e) => setMinSnr(e.target.value)}
              className="custom-input"
              style={{ padding: '8px 12px', fontSize: '13px' }}
              placeholder="-20"
            />
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Max SNR Target (dB)
            </label>
            <input
              type="number"
              value={maxSnr}
              onChange={(e) => setMaxSnr(e.target.value)}
              className="custom-input"
              style={{ padding: '8px 12px', fontSize: '13px' }}
              placeholder="20"
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn-primary" style={{ padding: '9px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', width: 'auto', boxShadow: 'none' }}>
              <Search size={14} />
              Filter
            </button>
            <button type="button" onClick={resetFilters} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '13px' }}>
              Clear
            </button>
          </div>
        </form>
      </section>

      {/* Main Audit Record Table */}
      <section className="glass-panel" style={{ padding: '24px', borderRadius: '12px' }}>
        <div className="flex-between" style={{ marginBottom: '16px' }}>
          <h4 style={{ fontSize: '15px' }}>Historical Quality Runs Log</h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={exportToCSV}
              disabled={runs.length === 0}
              className="btn-secondary"
              style={{ padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', color: runs.length === 0 ? 'var(--text-muted)' : 'var(--color-primary)', cursor: runs.length === 0 ? 'not-allowed' : 'pointer' }}
            >
              <Download size={14} />
              Export CSV
            </button>
            <button onClick={fetchRuns} className="btn-secondary" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--color-danger)', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '10px' }}>
              <span className="spinner" style={{ width: '32px', height: '32px' }}></span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Querying secure archives...</span>
            </div>
          ) : runs.length === 0 ? (
            <div style={{ textAlignment: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px' }}>
              No audit records matched standard filters.
            </div>
          ) : (
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Analyst</th>
                  <th>Recording</th>
                  <th>Noise Type</th>
                  <th>Target SNR</th>
                  <th>PESQ Score</th>
                  <th>STOI Index</th>
                  <th>Post-Mix SNR</th>
                  <th>Execution Time</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-primary)' }}>#{run.id}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-bright)' }}>{run.analyst_username}</span>
                      </div>
                    </td>
                    <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={run.clean_file_name}>
                      {run.clean_file_name}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{run.noise_type}</td>
                    <td>{run.snr_db} dB</td>
                    <td style={{ fontWeight: 700 }} className={run.pesq_score >= 3.5 ? 'score-good' : run.pesq_score >= 2.5 ? 'score-mid' : 'score-poor'}>
                      {run.pesq_score.toFixed(2)}
                    </td>
                    <td style={{ fontWeight: 700 }} className={run.stoi_score >= 0.8 ? 'score-good' : run.stoi_score >= 0.6 ? 'score-mid' : 'score-poor'}>
                      {run.stoi_score.toFixed(2)}
                    </td>
                    <td>{run.final_snr.toFixed(1)} dB</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      {new Date(run.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Dynamic Pagination Footer */}
        {total > limit && (
          <div className="flex-between" style={{ marginTop: '20px', padding: '10px 0', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing {runs.length} of {total} records
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px', opacity: page === 1 ? 0.5 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
              >
                Previous
              </button>
              <button
                disabled={page * limit >= total}
                onClick={() => setPage(p => p + 1)}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px', opacity: page * limit >= total ? 0.5 : 1, cursor: page * limit >= total ? 'not-allowed' : 'pointer' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default SupervisorView;
