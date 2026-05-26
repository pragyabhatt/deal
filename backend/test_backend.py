import sys
import os
import numpy as np

# Ensure app path is loaded
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.kpi import mix_audio_at_snr, resample_audio, compute_kpis

def test_dsp_pipeline():
    print("--- DEAL DSP Quality Pipeline Test ---")
    
    # 1. Generate test sine wave (simulate audio at 48000 Hz)
    fs_orig = 48000
    duration = 2.0  # seconds
    t = np.linspace(0, duration, int(fs_orig * duration), endpoint=False)
    # 440 Hz standard speech fundamental approximation
    clean_signal = 0.5 * np.sin(2 * np.pi * 440 * t)
    
    print(f"Generated clean wave: {len(clean_signal)} samples, fs={fs_orig} Hz, length={duration}s")
    assert len(clean_signal) == 96000, "Clean signal length mismatch"
    
    # 2. Test resampling safety layer
    # Resample from 48000 Hz to 16000 Hz for PESQ/STOI alignment
    target_fs = 16000
    resampled_signal = resample_audio(clean_signal, fs_orig, target_fs)
    print(f"Resampled clean wave: {len(resampled_signal)} samples, target_fs={target_fs} Hz")
    expected_samples = int(duration * target_fs)
    assert abs(len(resampled_signal) - expected_samples) <= 2, f"Resampling decimation length drift: {len(resampled_signal)} vs {expected_samples}"
    
    # 3. Test noise injection and SNR mixing
    # Mix white noise at 5.0 dB SNR
    target_snr = 5.0
    mixed, scaled_noise, actual_snr = mix_audio_at_snr(clean_signal, "white", target_snr, fs_orig)
    print(f"Mixed signal SNR target: {target_snr} dB, Actual computed SNR: {actual_snr:.2f} dB")
    assert abs(actual_snr - target_snr) < 1e-5, f"SNR mixing precision error: target={target_snr}, actual={actual_snr}"
    
    # 4. Test KPI calculation fallbacks
    # Compute PESQ and STOI indexes
    snr_score, pesq_score, stoi_score = compute_kpis(clean_signal, mixed, fs_orig, "white", target_snr)
    print(f"KPI results -> SNR: {snr_score:.2f} dB, PESQ (MOS): {pesq_score:.2f}, STOI index: {stoi_score:.2f}")
    
    assert 1.0 <= pesq_score <= 4.5, f"PESQ bounds breach: {pesq_score}"
    assert 0.0 <= stoi_score <= 1.0, f"STOI bounds breach: {stoi_score}"
    
    print("\n[SUCCESS] DSP Quality Pipeline successfully passed all unit verifications!")

if __name__ == "__main__":
    test_dsp_pipeline()
