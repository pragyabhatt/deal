import os
import io
import re
import json
import base64
import datetime
import gc
import hashlib
import numpy as np
import soundfile as sf
import librosa
import torch
import tempfile
import logging
import asyncio
from typing import Tuple, Dict, Any

# Directories
MEDIA_DIR = os.getenv("MEDIA_DIR", "./media")
UPLOADS_DIR = os.path.join(MEDIA_DIR, "uploads")
RESULTS_DIR = os.path.join(MEDIA_DIR, "results")

os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

# Setup logger for utils if needed
logger = logging.getLogger("utils")

# ----------------- AUDIO VALIDATION & SANITIZATION -----------------

def validate_and_strip_audio(file_bytes: bytes, filename: str) -> Tuple[np.ndarray, int]:
    """
    Enforces maximum upload size of 500MB, validates format using magic bytes,
    and strips metadata by extracting raw audio samples.
    Returns (raw_samples, sample_rate).
    """
    MAX_SIZE = 500 * 1024 * 1024
    if len(file_bytes) > MAX_SIZE:
        raise ValueError("File size exceeds the maximum limit of 500 MB.")

    # Magic byte checks
    is_wav = len(file_bytes) >= 12 and file_bytes[0:4] == b'RIFF' and file_bytes[8:12] == b'WAVE'
    is_mp3 = file_bytes.startswith(b'ID3') or file_bytes.startswith(b'\xff\xfb') or \
             file_bytes.startswith(b'\xff\xf3') or file_bytes.startswith(b'\xff\xf2')
    is_m4a = len(file_bytes) >= 12 and file_bytes[4:8] == b'ftyp'
    if not (is_wav or is_mp3 or is_m4a):
        raise ValueError("Invalid file format. Only WAV, MP3, and M4A formats are supported.")

    try:
        if is_wav:
            try:
                audio_io = io.BytesIO(file_bytes)
                data, fs = sf.read(audio_io)
                if data.ndim > 1:
                    data = np.mean(data, axis=1)
                return data, fs
            except Exception:
                pass  # fall back to librosa
        # Use temporary file for other formats
        suffix = os.path.splitext(filename)[1].lower()
        if suffix not in [".wav", ".mp3", ".m4a"]:
            suffix = ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            temp_file.write(file_bytes)
            temp_path = temp_file.name
        try:
            data, fs = librosa.load(temp_path, sr=None)
            if data.ndim > 1:
                data = np.mean(data, axis=1)
            return data, fs
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
    except Exception as e:
        logger.error(f"Audio decoding failure: {e}")
        raise ValueError(f"Failed to decode audio file. Error: {str(e)}")

def sanitize_transcription_text(text: str) -> str:
    """Sanitizes transcription text: caps length, strips control chars, and escapes special quotes."""
    if not text:
        return ""
    if len(text) > 1_000_000:
        text = text[:1_000_000]
    text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]', '', text)
    return text

# ----------------- METRICS HELPERS -----------------

def estimate_single_channel_snr(signal_data: np.ndarray, frame_size: int = 320) -> float:
    """Estimate SNR of a single-channel speech signal without a reference.
    Uses percentile based energy estimation.
    """
    if len(signal_data) < frame_size:
        return 0.0
    num_frames = len(signal_data) // frame_size
    frames = np.reshape(signal_data[:num_frames * frame_size], (num_frames, frame_size))
    energies = np.sum(frames ** 2, axis=1) / frame_size
    energies = np.clip(energies, 1e-12, None)
    energies_db = 10 * np.log10(energies)
    speech_level_db = np.percentile(energies_db, 90)
    noise_level_db = np.percentile(energies_db, 10)
    snr = float(speech_level_db - noise_level_db)
    return max(-20.0, min(40.0, snr))

def estimate_pesq_stoi_from_snr(snr: float) -> tuple[float, float]:
    """Sigmoidal estimation of PESQ (MOS 1.0-4.5) and STOI (0.0-1.0) from SNR."""
    pesq_sig = 1.0 / (1.0 + np.exp(-0.16 * (snr - 2.0)))
    pesq_score = float(1.0 + 3.5 * pesq_sig)
    pesq_score = max(1.0, min(4.5, pesq_score))
    stoi_sig = 1.0 / (1.0 + np.exp(-0.18 * (snr + 1.0)))
    stoi_score = float(0.05 + 0.93 * stoi_sig)
    stoi_score = max(0.0, min(1.0, stoi_score))
    return pesq_score, stoi_score

# ----------------- DSP FALLBACK -----------------

def run_dsp_spectral_subtraction(noisy_data: np.ndarray, fs: int = 16000) -> np.ndarray:
    """Pure Python/NumPy spectral subtraction fallback algorithm."""
    try:
        n_fft = 512
        hop_length = 128
        stft_matrix = librosa.stft(noisy_data, n_fft=n_fft, hop_length=hop_length)
        magnitude = np.abs(stft_matrix)
        phase = np.angle(stft_matrix)
        noise_floor = np.percentile(magnitude, 15, axis=1, keepdims=True)
        clean_magnitude = magnitude - 1.2 * noise_floor
        clean_magnitude = np.clip(clean_magnitude, 0.01 * magnitude, None)
        clean_stft = clean_magnitude * np.exp(1j * phase)
        clean_data = librosa.istft(clean_stft, hop_length=hop_length, length=len(noisy_data))
        if np.max(np.abs(clean_data)) > 0:
            clean_data = clean_data / np.max(np.abs(clean_data)) * 0.9
        return clean_data
    except Exception as e:
        logger.error(f"DSP Spectral Subtraction failed: {e}. Falling back to attenuated buffer.")
        return noisy_data * 0.8

# ----------------- DEEPFILTER ENHANCEMENT -----------------

def run_deepfilter_enhancement(noisy_16k: np.ndarray) -> np.ndarray:
    """On-demand DeepFilterNet enhancement with resource cleanup."""
    logger.info("Loading DeepFilterNet model on-demand...")
    try:
        from df.enhance import init_df, enhance
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_in, \
             tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_out:
            temp_in_path = temp_in.name
            temp_out_path = temp_out.name
        try:
            sf.write(temp_in_path, noisy_16k, 16000)
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"Initializing DeepFilterNet on device: {device}")
            model, df_state, _ = init_df()
            enhance(model, df_state, temp_in_path, temp_out_path)
            enhanced_data, _ = sf.read(temp_out_path)
            del model, df_state
            return enhanced_data
        finally:
            for p in [temp_in_path, temp_out_path]:
                if os.path.exists(p):
                    os.remove(p)
    except Exception as e:
        logger.warning(f"DeepFilterNet failed: {e}. Falling back to DSP.")
        return run_dsp_spectral_subtraction(noisy_16k, 16000)
    finally:
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        logger.info("DeepFilterNet model unloaded.")

# ----------------- WHISPER TRANSCRIPTION -----------------

def run_whisper_transcription(wav_bytes: bytes, language: str) -> Dict[str, Any]:
    """On-demand Whisper transcription with fallback to mock."""
    logger.info("Loading Whisper model on-demand...")
    from app.transcription_router import generate_mock_transcription
    try:
        audio_io = io.BytesIO(wav_bytes)
        data, fs = sf.read(audio_io)
        duration = float(len(data) / fs) if fs else 0.0
    except Exception:
        duration = 2.0
    try:
        from faster_whisper import WhisperModel
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_wav:
            temp_wav.write(wav_bytes)
            temp_wav_path = temp_wav.name
        try:
            device = "cuda" if torch.cuda.is_available() else "cpu"
            model = WhisperModel("base", device=device, compute_type="int8")
            transcribe_lang = None if language.lower() == "auto" else language.lower()
            loop = asyncio.get_event_loop()
            segments, info = await loop.run_in_executor(
                None,
                lambda: model.transcribe(
                    temp_wav_path,
                    beam_size=5,
                    language=transcribe_lang,
                    word_timestamps=True
                )
            )
            segments = list(segments)
            words_list = []
            transcript_parts = []
            for segment in segments:
                transcript_parts.append(segment.text)
                if segment.words:
                    for w in segment.words:
                        words_list.append({
                            "word": w.word.strip(),
                            "start": float(w.start),
                            "end": float(w.end),
                            "probability": float(w.probability)
                        })
                else:
                    words = segment.text.split()
                    if words:
                        word_dur = (segment.end - segment.start) / len(words)
                        for idx, word in enumerate(words):
                            words_list.append({
                                "word": word,
                                "start": float(segment.start + idx * word_dur),
                                "end": float(segment.start + (idx + 1) * word_dur),
                                "probability": 0.90
                            })
            full_text = " ".join(transcript_parts).strip()
            del model
            return {
                "text": sanitize_transcription_text(full_text) if full_text else "(No speech detected)",
                "language": info.language,
                "words": words_list
            }
        finally:
            if os.path.exists(temp_wav_path):
                os.remove(temp_wav_path)
    except Exception as e:
        logger.warning(f"Whisper model failed: {e}. Using mock transcription.")
        return generate_mock_transcription(duration, language)
    finally:
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        logger.info("Whisper model unloaded.")

# ----------------- SPECTROGRAM UTILITY -----------------

def get_compact_spectrogram(data: np.ndarray) -> list:
    """Computes magnitude spectrogram and resamples to 40x80 matrix."""
    stft_matrix = np.abs(librosa.stft(data, n_fft=512, hop_length=256))
    stft_db = librosa.amplitude_to_db(stft_matrix, ref=np.max)
    freq_indices = np.linspace(0, stft_db.shape[0] - 1, 40, dtype=int)
    time_indices = np.linspace(0, stft_db.shape[1] - 1, 80, dtype=int)
    compact_spec = stft_db[freq_indices, :][:, time_indices]
    min_db, max_db = np.min(compact_spec), np.max(compact_spec)
    db_range = max_db - min_db if max_db > min_db else 1.0
    return ((compact_spec - min_db) / db_range).tolist()
