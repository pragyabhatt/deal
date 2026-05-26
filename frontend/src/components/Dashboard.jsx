import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Upload, HelpCircle, AudioLines, Flame, Info, CheckCircle2 } from 'lucide-react';

const Dashboard = () => {
  const { apiFetch } = useAuth();
  const [file, setFile] = useState(null);
  const [noiseType, setNoiseType] = useState('white');
  const [snr, setSnr] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const canvasRef = useRef(null);

  // Draw spectrogram on canvas when results are loaded
  useEffect(() => {
    if (results && results.spectrogram && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const spec = results.spectrogram; // 40 (freq) x 80 (time) array

      const h = spec.length;
      const w = spec[0].length;
      
      canvas.width = 600;
      canvas.height = 180;

      const cellW = canvas.width / w;
      const cellH = canvas.height / h;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw each spectrogram element with cyber-punk flame gradient
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const val = spec[y][x]; // Normalized float 0.0 to 1.0

          // Cyber gradient mapping: deep purple -> hot pink -> neon orange -> cyber yellow
          let r, g, b;
          if (val < 0.25) {
            // Deep Purple-Blue
            r = Math.floor(val * 4 * 40);
            g = Math.floor(val * 4 * 10);
            b = Math.floor(60 + val * 4 * 80);
          } else if (val < 0.5) {
            // Hot Pink/Violet
            r = Math.floor(40 + (val - 0.25) * 4 * 180);
            g = Math.floor(10 + (val - 0.25) * 4 * 30);
            b = Math.floor(140 + (val - 0.25) * 4 * 40);
          } else if (val < 0.75) {
            // Neon Orange
            r = Math.floor(220 + (val - 0.5) * 4 * 35);
            g = Math.floor(40 + (val - 0.5) * 4 * 120);
            b = Math.floor(180 - (val - 0.5) * 4 * 150);
          } else {
            // Cyber Cyan / Yellow heat
            r = Math.floor(255);
            g = Math.floor(160 + (val - 0.75) * 4 * 95);
            b = Math.floor(30 + (val - 0.75) * 4 * 200);
          }

          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          // Draw inverted vertically because high frequencies are at the top
          ctx.fillRect(x * cellW, canvas.height - (y * cellH) - cellH, cellW + 0.5, cellH + 0.5);
        }
      }
    }
  }, [results]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.wav')) {
        setFile(droppedFile);
        setError('');
      } else {
        setError('Only WAV audio format is supported by the DEAL engine.');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.wav')) {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Only WAV audio format is supported by the DEAL engine.');
      }
    }
  };

  const runAnalysis = async () => {
    if (!file) {
      setError('Please select or drop a clean signal WAV file first.');
      return;
    }
    setError('');
    setLoading(true);

    const formData = new FormData();
    formData.append('clean_file', file);
    formData.append('noise_type', noiseType);
    formData.append('snr_db', snr);

    try {
      const res = await apiFetch('/api/analysis/run', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Analysis calculation failed');
      }

      const data = await res.json();
      setResults(data);
    } catch (err) {
      setError(err.message || 'Server computation error');
    } finally {
      setLoading(false);
    }
  };

  // Determine score color classifications
  const getPesqClass = (val) => {
    if (val >= 3.5) return 'score-good';
    if (val >= 2.5) return 'score-mid';
    return 'score-poor';
  };

  const getStoiClass = (val) => {
    if (val >= 0.8) return 'score-good';
    if (val >= 0.6) return 'score-mid';
    return 'score-poor';
  };

  const getSnrColorClass = (val) => {
    if (val >= 10) return 'score-good';
    if (val >= 0) return 'score-mid';
    return 'score-poor';
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px', minHeight: 'calc(100vh - 120px)' }}>
      {/* Configuration Column */}
      <section className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', borderRadius: '16px' }}>
        <div>
          <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AudioLines size={18} color="var(--color-primary)" />
            Signal Config
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
            Configure and run audio degradation tests.
          </p>
        </div>

        {/* File Uploader */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
            Clean Signal (WAV)
          </label>
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            style={{
              border: '2px dashed ' + (dragActive ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.08)'),
              borderRadius: '10px',
              padding: '24px 16px',
              textAlign: 'center',
              background: dragActive ? 'rgba(0, 255, 213, 0.02)' : 'rgba(255, 255, 255, 0.01)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'var(--transition-smooth)'
            }}
            onClick={() => document.getElementById('audio-upload').click()}
          >
            <input
              id="audio-upload"
              type="file"
              accept=".wav"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            {file ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={32} color="var(--color-success)" style={{ filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.3))' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-bright)', wordBreak: 'break-all' }}>
                  {file.name}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Upload size={32} color="var(--text-muted)" />
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-bright)' }}>
                  Choose WAV or Drag Here
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Auto Resampling Security Engaged
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Noise Type Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
            Channel Interference Noise
          </label>
          <select
            value={noiseType}
            onChange={(e) => setNoiseType(e.target.value)}
            className="custom-select"
          >
            <option value="white">White Gaussian Noise</option>
            <option value="pink">Pink Flicker (1/f) Noise</option>
            <option value="babble">Multi-Talker Babble Interference</option>
            <option value="factory">Factory Industrial Clatter</option>
          </select>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <Info size={12} color="var(--color-secondary)" />
            {noiseType === 'white' && 'Constant spectral density (standard benchmark).'}
            {noiseType === 'pink' && 'Low-frequency heavy modeling (natural flicker).'}
            {noiseType === 'babble' && 'Speech-like chatter interference.'}
            {noiseType === 'factory' && 'Low industrial motor hum & random impacts.'}
          </span>
        </div>

        {/* SNR Slider */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="flex-between">
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              Target SNR Ratio
            </label>
            <span style={{
              fontSize: '14px',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              color: 'var(--color-primary)',
              background: 'rgba(0, 255, 213, 0.05)',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(0, 255, 213, 0.15)'
            }}>
              {snr > 0 ? `+${snr}` : snr} dB
            </span>
          </div>
          <div className="slider-container">
            <input
              type="range"
              min="-20"
              max="20"
              value={snr}
              onChange={(e) => setSnr(parseInt(e.target.value))}
              className="custom-slider"
            />
          </div>
          <div className="flex-between" style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>
            <span>Heavy Noise (-20 dB)</span>
            <span>Clean (20 dB)</span>
          </div>
        </div>

        {/* Error panel */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.07)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            padding: '10px 12px',
            borderRadius: '6px',
            color: 'var(--color-danger)',
            fontSize: '12px',
            lineHeight: '1.4'
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={runAnalysis}
          disabled={loading || !file}
          className="btn-primary"
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: (!file || loading) ? 0.6 : 1,
            cursor: (!file || loading) ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              Resampling & Calculating...
            </>
          ) : 'Run Assessment Engine'}
        </button>
      </section>

      {/* Visual Analytics Column */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {results ? (
          <>
            {/* KPI Cards Panel */}
            <div className="grid-cols-3">
              {/* PESQ MOS Card */}
              <div className="glass-panel kpi-card" style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: '12px', right: '12px', opacity: 0.5 }}>
                  <HelpCircle size={14} title="Perceptual Evaluation of Speech Quality (Mean Opinion Score 1-4.5)" />
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  PESQ Score (MOS)
                </span>
                <div className={`kpi-value ${getPesqClass(results.pesq_score)}`}>
                  {results.pesq_score.toFixed(2)}
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>
                  {results.pesq_score >= 3.5 ? 'Excellent Intelligibility' : results.pesq_score >= 2.5 ? 'Acceptable degradation' : 'Unacceptable distortion'}
                </span>
              </div>

              {/* STOI Card */}
              <div className="glass-panel kpi-card" style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: '12px', right: '12px', opacity: 0.5 }}>
                  <HelpCircle size={14} title="Short-Time Objective Intelligibility (0.0 to 1.0 index)" />
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  STOI Index
                </span>
                <div className={`kpi-value ${getStoiClass(results.stoi_score)}`}>
                  {results.stoi_score.toFixed(2)}
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>
                  {results.stoi_score >= 0.8 ? 'Highly Intelligible' : results.stoi_score >= 0.6 ? 'Moderate recovery' : 'Poor word recognition'}
                </span>
              </div>

              {/* Final SNR Card */}
              <div className="glass-panel kpi-card" style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: '12px', right: '12px', opacity: 0.5 }}>
                  <HelpCircle size={14} title="Computed post-mix signal to noise ratio in decibels" />
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Post-Mix SNR
                </span>
                <div className={`kpi-value ${getSnrColorClass(results.final_snr)}`}>
                  {results.final_snr.toFixed(1)} dB
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>
                  Target request: {results.snr_db} dB
                </span>
              </div>
            </div>

            {/* Waveform Drawer Panel */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="flex-between">
                <h4 style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AudioLines size={16} color="var(--color-primary)" />
                  Signal Waveform Comparison (Clean vs Noisy)
                </h4>
                <div style={{ display: 'flex', gap: '12px', fontSize: '11px', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'rgba(59, 130, 246, 0.65)', borderRadius: '2px' }}></span>
                    Clean Signal
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'rgba(0, 255, 213, 0.65)', borderRadius: '2px' }}></span>
                    Noisy Mixed (Interference)
                  </span>
                </div>
              </div>

              {/* Premium Vector SVG Waveform envelopes */}
              <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', height: '140px', display: 'flex', padding: '10px 0', position: 'relative' }}>
                <svg width="100%" height="100%" viewBox="0 0 600 120" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0 }}>
                  {/* Draw Clean Speech Waveform in Blue */}
                  <path
                    d={results.clean_waveform.reduce((path, peak, index) => {
                      const x = (index / (results.clean_waveform.length - 1)) * 600;
                      const y1 = 60 - peak * 55;
                      const y2 = 60 + peak * 55;
                      return `${path} M ${x} ${y1} L ${x} ${y2}`;
                    }, '')}
                    stroke="rgba(59, 130, 246, 0.6)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  {/* Draw Noisy Mixed Waveform Overlay in Cyan */}
                  <path
                    d={results.mixed_waveform.reduce((path, peak, index) => {
                      const x = (index / (results.mixed_waveform.length - 1)) * 600;
                      const y1 = 60 - peak * 55;
                      const y2 = 60 + peak * 55;
                      return `${path} M ${x} ${y1} L ${x} ${y2}`;
                    }, '')}
                    stroke="rgba(0, 255, 213, 0.55)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="flex-between" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>Time: 0.0s</span>
                <span>Original rate: {results.fs} Hz • Duration: {results.duration.toFixed(2)}s</span>
                <span>Time: {results.duration.toFixed(1)}s</span>
              </div>
            </div>

            {/* Spectrogram Panel */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h4 style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Flame size={16} color="var(--color-primary)" />
                Time-Frequency Power Spectrogram (Clean Signal STFT)
              </h4>
              <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
                <canvas ref={canvasRef} style={{ width: '100%', maxWidth: '600px', display: 'block', height: '180px' }} />
              </div>
              <div className="flex-between" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>Time: 0.0s</span>
                <span>Color bar: Signal Magnitude (dB normalized)</span>
                <span>Time: {results.duration.toFixed(1)}s</span>
              </div>
            </div>
          </>
        ) : (
          /* Landing Screen placeholder */
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.08)' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <AudioLines size={32} color="var(--text-muted)" style={{ opacity: 0.7 }} />
            </div>
            <h4 style={{ fontSize: '18px', fontWeight: 600 }}>DEAL Objective Metrics Console</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '380px', marginTop: '8px', lineHeight: '1.5' }}>
              Upload an audio WAV recording clean signal, configure the interference properties, and run calculations to inspect waveforms, STFT spectrographs, and computed quality PESQ & STOI indexes.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
