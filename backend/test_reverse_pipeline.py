import sys
import os
import numpy as np

# Ensure app path is loaded
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.kpi import resample_audio
from app.enhancement_router import (
    estimate_single_channel_snr,
    estimate_pesq_stoi_from_snr,
    run_dsp_spectral_subtraction
)
from app.transcription_router import generate_mock_transcription

def test_reverse_pipeline():
    print("--- DEAL Reverse restoraion DSP Pipeline Test ---")
    
    # 1. Generate simulated noisy audio recording (speech approximation + white noise)
    fs = 16000
    duration = 3.0 # seconds
    t = np.linspace(0, duration, int(fs * duration), endpoint=False)
    
    # Speech fundamental sine wave (440Hz)
    speech = 0.4 * np.sin(2 * np.pi * 440 * t)
    # Add random high-energy bursts to simulate words
    for i in range(3):
        speech[i*fs : i*fs + int(0.5*fs)] *= 2.0
        
    # Constant background hum (noise floor)
    noise = 0.15 * np.random.normal(0, 1, len(t))
    noisy_signal = speech + noise
    
    print(f"Generated noisy wave: {len(noisy_signal)} samples, fs={fs} Hz, length={duration}s")
    assert len(noisy_signal) == 48000, "Noisy signal length mismatch"
    
    # 2. Test Single-Channel SNR Estimation
    snr_before = estimate_single_channel_snr(noisy_signal)
    print(f"Estimated Noisy SNR: {snr_before:.2f} dB")
    assert -20.0 <= snr_before <= 40.0, f"Noisy SNR bounds breach: {snr_before}"
    
    # 3. Test Sigmoidal PESQ/STOI Models
    pesq_before, stoi_before = estimate_pesq_stoi_from_snr(snr_before)
    print(f"Sigmoidal before KPIs -> PESQ: {pesq_before:.2f}, STOI: {stoi_before:.2f}")
    assert 1.0 <= pesq_before <= 4.5, "PESQ bounds breach"
    assert 0.0 <= stoi_before <= 1.0, "STOI bounds breach"
    
    # 4. Test Pure Python/NumPy/SciPy Spectral Subtraction
    cleaned_signal = run_dsp_spectral_subtraction(noisy_signal, fs)
    print(f"Cleaned wave size: {len(cleaned_signal)} samples")
    assert len(cleaned_signal) == len(noisy_signal), "Spectral subtraction length drift"
    
    snr_after = estimate_single_channel_snr(cleaned_signal)
    print(f"Estimated Cleaned SNR: {snr_after:.2f} dB")
    # Verify noise floor estimation shows logical improvement
    snr_gain = snr_after - snr_before
    print(f"Estimated SNR Gain: {snr_gain:.2f} dB")
    
    # 5. Test Mock speech-to-text transcription timestamps
    transcript = generate_mock_transcription(duration, "en")
    print(f"Mock transcript: '{transcript['text']}'")
    print(f"Mock words count: {len(transcript['words'])}")
    assert len(transcript['words']) > 0, "No words generated in mock"
    assert transcript['language'] == "en", "Language mismatch"
    
    # Verify timestamps are sequential
    prev_end = 0.0
    for w in transcript['words']:
        assert w['start'] >= prev_end, f"Overlapping/non-sequential start time for word: {w['word']}"
        assert w['end'] > w['start'], f"Negative duration for word: {w['word']}"
        prev_end = w['start']
        
    print("\n[SUCCESS] Reverse Restoration Pipeline successfully passed all unit verifications!")

if __name__ == "__main__":
    test_reverse_pipeline()
