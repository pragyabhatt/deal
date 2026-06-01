import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Upload, HelpCircle, AudioLines, Flame, Info, CheckCircle2, FileAudio, Languages, Cpu, Play, Download, Sparkles } from 'lucide-react';

const Dashboard = () => {
  const { apiFetch } = useAuth();
  
  // Cybersecurity nested sub-tabs
  const [activeSubTab, setActiveSubTab] = useState('noise-injection'); // 'noise-injection' or 'enhance-transcribe'

  // ==========================================
  // FORWARD PIPELINE: NOISE INJECTION STATES
  // ==========================================
  const [file, setFile] = useState(null);
  const [noiseType, setNoiseType] = useState('white');
  const [snr, setSnr] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const canvasRef = useRef(null);

  // ==========================================
  // REVERSE PIPELINE: ENHANCE & TRANSCRIBE STATES
  // ==========================================
  const [noisyFile, setNoisyFile] = useState(null);
  const [enhanceMethod, setEnhanceMethod] = useState('deep'); // 'fast' or 'deep'
  const [whisperLang, setWhisperLang] = useState('auto'); // 'auto', 'en', 'hi'
  const [enhanceLoading, setEnhanceLoading] = useState(false);
  const [enhanceError, setEnhanceError] = useState('');
  const [enhanceResults, setEnhanceResults] = useState(null);
  const [noisyDragActive, setNoisyDragActive] = useState(false);
  const noisyCanvasRef = useRef(null);
  const enhancedCanvasRef = useRef(null);

  // Reusable spectrogram painting utility
  const paintSpectrogram = (canvas, spec) => {
    if (!canvas || !spec) return;
    const ctx = canvas.getContext('2d');
    const h = spec.length;
    const w = spec[0].length;
    
    canvas.width = 600;
    canvas.height = 180;

    const cellW = canvas.width / w;
    const cellH = canvas.height / h;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const val = spec[y][x]; // Normalized float 0.0 to 1.0

        // Cyber-punk flame gradient mapping: deep purple -> hot pink -> neon orange -> cyber yellow
        let r, g, b;
        if (val < 0.25) {
          r = Math.floor(val * 4 * 40);
          g = Math.floor(val * 4 * 10);
          b = Math.floor(60 + val * 4 * 80);
        } else if (val < 0.5) {
          r = Math.floor(40 + (val - 0.25) * 4 * 180);
          g = Math.floor(10 + (val - 0.25) * 4 * 30);
          b = Math.floor(140 + (val - 0.25) * 4 * 40);
        } else if (val < 0.75) {
          r = Math.floor(220 + (val - 0.5) * 4 * 35);
          g = Math.floor(40 + (val - 0.5) * 4 * 120);
          b = Math.floor(180 - (val - 0.5) * 4 * 150);
        } else {
          r = Math.floor(255);
          g = Math.floor(160 + (val - 0.75) * 4 * 95);
          b = Math.floor(30 + (val - 0.75) * 4 * 200);
        }

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x * cellW, canvas.height - (y * cellH) - cellH, cellW + 0.5, cellH + 0.5);
      }
    }
  };

  // Draw Forward Spectrogram
  useEffect(() => {
    if (activeSubTab === 'noise-injection' && results && results.spectrogram && canvasRef.current) {
      paintSpectrogram(canvasRef.current, results.spectrogram);
    }
  }, [results, activeSubTab]);

  // Draw Reverse Spectrograms (Noisy & Enhanced)
  useEffect(() => {
    if (activeSubTab === 'enhance-transcribe' && enhanceResults) {
      if (enhanceResults.noisy_spectrogram && noisyCanvasRef.current) {
        paintSpectrogram(noisyCanvasRef.current, enhanceResults.noisy_spectrogram);
      }
      if (enhanceResults.enhanced_spectrogram && enhancedCanvasRef.current) {
        paintSpectrogram(enhancedCanvasRef.current, enhanceResults.enhanced_spectrogram);
      }
    }
  }, [enhanceResults, activeSubTab]);

  // ==========================================
  // FORWARD DRAG & DROP EVENTS
  // ==========================================
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

  // ==========================================
  // REVERSE DRAG & DROP EVENTS
  // ==========================================
  const handleNoisyDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setNoisyDragActive(true);
    } else if (e.type === "dragleave") {
      setNoisyDragActive(false);
    }
  };

  const handleNoisyDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setNoisyDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.wav')) {
        setNoisyFile(droppedFile);
        setEnhanceError('');
      } else {
        setEnhanceError('Only WAV audio format is supported by the DEAL engine.');
      }
    }
  };

  const handleNoisyFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.wav')) {
        setNoisyFile(selectedFile);
        setEnhanceError('');
      } else {
        setEnhanceError('Only WAV audio format is supported by the DEAL engine.');
      }
    }
  };

  // ==========================================
  // EXECUTION TRIGGERS
  // ==========================================
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

  const runEnhancement = async () => {
    if (!noisyFile) {
      setEnhanceError('Please select or drop a noisy signal WAV file first.');
      return;
    }
    setEnhanceError('');
    setEnhanceLoading(true);

    const formData = new FormData();
    formData.append('file', noisyFile);
    formData.append('method', enhanceMethod);
    formData.append('language', whisperLang);

    try {
      const res = await apiFetch('/api/enhancement/combined', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Enhancement & transcription pipeline failed');
      }

      const data = await res.json();
      setEnhanceResults(data);
    } catch (err) {
      setEnhanceError(err.message || 'Server processing error');
    } finally {
      setEnhanceLoading(false);
    }
  };

  // Safe offline WAV Downloader from in-memory base64 stream
  const downloadWavFile = () => {
    if (!enhanceResults || !enhanceResults.enhanced_audio) return;
    try {
      const base64Data = enhanceResults.enhanced_audio;
      const sliceSize = 1024;
      const byteCharacters = atob(base64Data);
      const byteArrays = [];
      
      for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }
      
      const blob = new Blob(byteArrays, { type: 'audio/wav' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Enhanced_${enhanceResults.uploaded_filename || 'recording.wav'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setEnhanceError("Failed to decode and assemble WAV download stream.");
    }
  };

  // Color categories
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Sub-tab Navigation */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveSubTab('noise-injection')}
          className={`btn-secondary`}
          style={{
            borderColor: activeSubTab === 'noise-injection' ? 'var(--color-primary)' : 'transparent',
            color: activeSubTab === 'noise-injection' ? 'var(--color-primary)' : 'var(--text-muted)',
            background: activeSubTab === 'noise-injection' ? 'rgba(0, 255, 213, 0.04)' : 'transparent',
            boxShadow: activeSubTab === 'noise-injection' ? '0 0 12px rgba(0, 255, 213, 0.15)' : 'none',
            fontSize: '13px',
            fontWeight: 600,
            transition: 'var(--transition-fast)'
          }}
        >
          Forward Pipeline: Noise Injection
        </button>
        <button
          onClick={() => setActiveSubTab('enhance-transcribe')}
          className={`btn-secondary`}
          style={{
            borderColor: activeSubTab === 'enhance-transcribe' ? 'var(--color-primary)' : 'transparent',
            color: activeSubTab === 'enhance-transcribe' ? 'var(--color-primary)' : 'var(--text-muted)',
            background: activeSubTab === 'enhance-transcribe' ? 'rgba(0, 255, 213, 0.04)' : 'transparent',
            boxShadow: activeSubTab === 'enhance-transcribe' ? '0 0 12px rgba(0, 255, 213, 0.15)' : 'none',
            fontSize: '13px',
            fontWeight: 600,
            transition: 'var(--transition-fast)'
          }}
        >
          Reverse Pipeline: Enhance & Transcribe
        </button>
      </div>

      {/* ========================================================
          FORWARD PIPELINE PANEL
          ======================================================== */}
      {activeSubTab === 'noise-injection' && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px', minHeight: 'calc(100vh - 180px)' }}>
          {/* Configuration Side */}
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
                <div className="grid-cols-3">
                  <div className="glass-panel kpi-card" style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '12px', right: '12px', opacity: 0.5 }}>
                      <HelpCircle size={14} title="Perceptual Evaluation of Speech Quality (MOS 1.0 - 4.5)" />
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

                  <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', height: '140px', display: 'flex', padding: '10px 0', position: 'relative' }}>
                    <svg width="100%" height="100%" viewBox="0 0 600 120" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0 }}>
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
      )}

      {/* ========================================================
          REVERSE PIPELINE: ENHANCE & TRANSCRIBE PANEL
          ======================================================== */}
      {activeSubTab === 'enhance-transcribe' && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px', minHeight: 'calc(100vh - 180px)' }}>
          {/* Configuration Column */}
          <section className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', borderRadius: '16px' }}>
            <div>
              <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="var(--color-primary)" />
                Enhancement Engine
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                Clean noisy signals and run offline transcription.
              </p>
            </div>

            {/* Noisy WAV Drag & Drop Uploader */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                Noisy Audio Recording (WAV)
              </label>
              <div
                onDragEnter={handleNoisyDrag}
                onDragOver={handleNoisyDrag}
                onDragLeave={handleNoisyDrag}
                onDrop={handleNoisyDrop}
                style={{
                  border: '2px dashed ' + (noisyDragActive ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.08)'),
                  borderRadius: '10px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: noisyDragActive ? 'rgba(0, 255, 213, 0.02)' : 'rgba(255, 255, 255, 0.01)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'var(--transition-smooth)'
                }}
                onClick={() => document.getElementById('noisy-audio-upload').click()}
              >
                <input
                  id="noisy-audio-upload"
                  type="file"
                  accept=".wav"
                  onChange={handleNoisyFileChange}
                  style={{ display: 'none' }}
                />
                {noisyFile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={32} color="var(--color-primary)" style={{ filter: 'drop-shadow(0 0 8px rgba(0,255,213,0.3))' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-bright)', wordBreak: 'break-all' }}>
                      {noisyFile.name}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {(noisyFile.size / (1024 * 1024)).toFixed(2)} MB • Ready
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <FileAudio size={32} color="var(--text-muted)" />
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-bright)' }}>
                      Select Noisy WAV or Drag Here
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Upload size supported up to 50MB
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Enhancement Mode Toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                Denoising Algorithm
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setEnhanceMethod('fast')}
                  className={`btn-secondary`}
                  style={{
                    padding: '8px',
                    fontSize: '12px',
                    borderColor: enhanceMethod === 'fast' ? 'var(--color-primary)' : 'transparent',
                    color: enhanceMethod === 'fast' ? 'var(--color-primary)' : 'var(--text-muted)',
                    background: enhanceMethod === 'fast' ? 'rgba(0, 255, 213, 0.05)' : 'transparent',
                    fontWeight: 600
                  }}
                >
                  Fast Mode
                </button>
                <button
                  type="button"
                  onClick={() => setEnhanceMethod('deep')}
                  className={`btn-secondary`}
                  style={{
                    padding: '8px',
                    fontSize: '12px',
                    borderColor: enhanceMethod === 'deep' ? 'var(--color-primary)' : 'transparent',
                    color: enhanceMethod === 'deep' ? 'var(--color-primary)' : 'var(--text-muted)',
                    background: enhanceMethod === 'deep' ? 'rgba(0, 255, 213, 0.05)' : 'transparent',
                    fontWeight: 600
                  }}
                >
                  High-Quality (DF)
                </button>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <Cpu size={12} color="var(--color-secondary)" />
                {enhanceMethod === 'fast' ? 'noisereduce CPU spectral noise subtraction.' : 'DeepFilterNet wideband deep neural network.'}
              </span>
            </div>

            {/* Whisper Language Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                Whisper Transcription Language
              </label>
              <select
                value={whisperLang}
                onChange={(e) => setWhisperLang(e.target.value)}
                className="custom-select"
              >
                <option value="auto">Auto-Detect Language</option>
                <option value="en">English (Wideband Radio)</option>
                <option value="hi">Hindi (डील कमांड्स)</option>
              </select>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <Languages size={12} color="var(--color-secondary)" />
                Loads local Whisper parameters offline.
              </span>
            </div>

            {enhanceError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.07)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                padding: '10px 12px',
                borderRadius: '6px',
                color: 'var(--color-danger)',
                fontSize: '12px',
                lineHeight: '1.4'
              }}>
                {enhanceError}
              </div>
            )}

            {/* Trigger Button */}
            <button
              onClick={runEnhancement}
              disabled={enhanceLoading || !noisyFile}
              className="btn-primary"
              style={{
                marginTop: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: (!noisyFile || enhanceLoading) ? 0.6 : 1,
                cursor: (!noisyFile || enhanceLoading) ? 'not-allowed' : 'pointer'
              }}
            >
              {enhanceLoading ? (
                <>
                  <span className="spinner"></span>
                  Denoising & Transcribing...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Trigger Enhance Pipeline
                </>
              )}
            </button>
          </section>

          {/* Visual Analytics Column */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {enhanceResults ? (
              <>
                {/* 1. Scorecard Panel */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  
                  {/* SNR Improvement */}
                  <div className="glass-panel kpi-card" style={{ padding: '16px 12px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      SNR Improvement
                    </span>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-primary)', textShadow: '0 0 10px rgba(0,255,213,0.2)', margin: '4px 0' }}>
                      +{enhanceResults.snr_improvement.toFixed(1)} dB
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Noise floor reduction
                    </span>
                  </div>

                  {/* PESQ Before/After */}
                  <div className="glass-panel kpi-card" style={{ padding: '16px 12px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      PESQ MOS
                    </span>
                    <div style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0' }}>
                      <span className="score-poor" style={{ fontSize: '15px' }}>{enhanceResults.pesq_before.toFixed(2)}</span>
                      <span style={{ color: 'var(--text-muted)', margin: '0 4px', fontSize: '13px' }}>→</span>
                      <span className="score-good">{enhanceResults.pesq_after.toFixed(2)}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Speech quality gain
                    </span>
                  </div>

                  {/* STOI Before/After */}
                  <div className="glass-panel kpi-card" style={{ padding: '16px 12px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      STOI Intelligibility
                    </span>
                    <div style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0' }}>
                      <span className="score-poor" style={{ fontSize: '15px' }}>{enhanceResults.stoi_before.toFixed(2)}</span>
                      <span style={{ color: 'var(--text-muted)', margin: '0 4px', fontSize: '13px' }}>→</span>
                      <span className="score-good">{enhanceResults.stoi_after.toFixed(2)}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Word recognition index
                    </span>
                  </div>

                  {/* WER Before/After */}
                  <div className="glass-panel kpi-card" style={{ padding: '16px 12px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      WER (Word Error)
                    </span>
                    <div style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0' }}>
                      <span className="score-poor" style={{ fontSize: '15px' }}>{(enhanceResults.wer_before * 100).toFixed(0)}%</span>
                      <span style={{ color: 'var(--text-muted)', margin: '0 4px', fontSize: '13px' }}>→</span>
                      <span className="score-good">{(enhanceResults.wer_after * 100).toFixed(0)}%</span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Transcription accuracy
                    </span>
                  </div>
                </div>

                {/* 2. Dual Waveform Stack */}
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="flex-between">
                    <h4 style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AudioLines size={16} color="var(--color-primary)" />
                      Waveform Comparison (Noisy Input vs Enhanced Output)
                    </h4>
                    <button
                      onClick={downloadWavFile}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)', border: '1px solid rgba(0, 255, 213, 0.2)' }}
                    >
                      <Download size={12} />
                      Download Clean WAV
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '8px' }}>
                    {/* Noisy Waveform */}
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '6px', height: '64px', position: 'relative', overflow: 'hidden' }}>
                      <span style={{ position: 'absolute', top: '4px', left: '8px', fontSize: '9px', fontWeight: 700, color: 'rgba(239, 68, 68, 0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Noisy Input Wave
                      </span>
                      <svg width="100%" height="100%" viewBox="0 0 600 60" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0 }}>
                        <path
                          d={enhanceResults.noisy_waveform.reduce((path, peak, index) => {
                            const x = (index / (enhanceResults.noisy_waveform.length - 1)) * 600;
                            const y1 = 30 - peak * 28;
                            const y2 = 30 + peak * 28;
                            return `${path} M ${x} ${y1} L ${x} ${y2}`;
                          }, '')}
                          stroke="rgba(239, 68, 68, 0.6)"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    {/* Enhanced Waveform */}
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '6px', height: '64px', position: 'relative', overflow: 'hidden' }}>
                      <span style={{ position: 'absolute', top: '4px', left: '8px', fontSize: '9px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Enhanced Clean Wave
                      </span>
                      <svg width="100%" height="100%" viewBox="0 0 600 60" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0 }}>
                        <path
                          d={enhanceResults.enhanced_waveform.reduce((path, peak, index) => {
                            const x = (index / (enhanceResults.enhanced_waveform.length - 1)) * 600;
                            const y1 = 30 - peak * 28;
                            const y2 = 30 + peak * 28;
                            return `${path} M ${x} ${y1} L ${x} ${y2}`;
                          }, '')}
                          stroke="rgba(0, 255, 213, 0.75)"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>

                  <div className="flex-between" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    <span>0.0s</span>
                    <span>Method: {enhanceResults.enhancement_method} • Resampled to 16kHz • Duration: {enhanceResults.duration.toFixed(2)}s</span>
                    <span>{enhanceResults.duration.toFixed(1)}s</span>
                  </div>
                </div>

                {/* 3. Dual Spectrograms Side-by-side */}
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h4 style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Flame size={16} color="var(--color-primary)" />
                    Visual Spectrogram Comparison (Witnessing the Noise Floor Drop)
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Noisy canvas */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(239, 68, 68, 0.7)' }}>Noisy Spectrogram</span>
                      <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px', overflow: 'hidden' }}>
                        <canvas ref={noisyCanvasRef} style={{ width: '100%', display: 'block', height: '140px' }} />
                      </div>
                    </div>

                    {/* Enhanced canvas */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)' }}>Enhanced Spectrogram</span>
                      <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px', overflow: 'hidden' }}>
                        <canvas ref={enhancedCanvasRef} style={{ width: '100%', display: 'block', height: '140px' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Side-by-side Transcripts */}
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h4 style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Languages size={16} color="var(--color-primary)" />
                    Speech-to-Text Comparison (Whisper Offline Inference)
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    
                    {/* Noisy Transcript Box */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(239, 68, 68, 0.7)' }}>What Whisper Heard in Noisy Input</span>
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.02)',
                        border: '1px solid rgba(239, 68, 68, 0.12)',
                        borderRadius: '8px',
                        padding: '16px',
                        fontSize: '13px',
                        minHeight: '80px',
                        lineHeight: '1.6',
                        color: 'rgba(255,255,255,0.85)'
                      }}>
                        {enhanceResults.noisy_transcript.text ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {enhanceResults.noisy_transcript.words.map((w, i) => (
                              <span
                                key={i}
                                title={`Start: ${w.start}s, Prob: ${(w.probability * 100).toFixed(0)}%`}
                                style={{
                                  color: w.probability < 0.6 ? 'var(--color-danger)' : 'rgba(255, 255, 255, 0.8)',
                                  background: w.probability < 0.6 ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                                  padding: '1px 3px',
                                  borderRadius: '3px'
                                }}
                              >
                                {w.word}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No speech elements decoded.</span>
                        )}
                      </div>
                    </div>

                    {/* Enhanced Transcript Box */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)' }}>What Whisper Heard in Cleaned Output</span>
                      <div style={{
                        background: 'rgba(0, 255, 213, 0.02)',
                        border: '1px solid rgba(0, 255, 213, 0.12)',
                        borderRadius: '8px',
                        padding: '16px',
                        fontSize: '13px',
                        minHeight: '80px',
                        lineHeight: '1.6',
                        color: 'var(--text-bright)'
                      }}>
                        {enhanceResults.enhanced_transcript.text ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {enhanceResults.enhanced_transcript.words.map((w, i) => (
                              <span
                                key={i}
                                title={`Start: ${w.start}s, Prob: ${(w.probability * 100).toFixed(0)}%`}
                                style={{
                                  color: 'var(--text-bright)',
                                  background: 'rgba(0, 255, 213, 0.03)',
                                  padding: '1px 3px',
                                  borderRadius: '3px',
                                  border: '1px solid rgba(0, 255, 213, 0.08)'
                                }}
                              >
                                {w.word}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No speech elements decoded.</span>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              </>
            ) : (
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
                  <Sparkles size={32} color="var(--text-muted)" style={{ opacity: 0.7 }} />
                </div>
                <h4 style={{ fontSize: '18px', fontWeight: 600 }}>DEAL Audio Restoration Console</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '380px', marginTop: '8px', lineHeight: '1.5' }}>
                  Upload a noisy field recording, select your enhancement method, specify the speech transcription language, and restaure the recording to clean signals while measuring actual intelligibility WER/SNR decibel improvement.
                </p>
              </div>
            )}
          </section>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
