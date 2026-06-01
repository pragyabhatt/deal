import os
import sys

def download_models():
    print("==================================================")
    print("DEAL Labs: Pre-downloading model weights for air-gapped runtimes")
    print("==================================================")
    
    # 1. Pre-download Whisper model weights
    try:
        print("Caching faster-whisper 'base' model...")
        from faster_whisper import WhisperModel
        # This will download the base model from huggingface and cache it locally
        model = WhisperModel("base", device="cpu", compute_type="int8")
        print("[SUCCESS] Whisper base model cached.")
    except Exception as e:
        print(f"[WARNING] Whisper caching encountered an error: {e}")
        print("The system will attempt dynamic download at runtime if needed, or use DSP fallback.")

    # 2. Pre-download DeepFilterNet weights
    try:
        print("Caching DeepFilterNet weights...")
        from df.enhance import init_df
        # This will trigger download of standard DeepFilterNet3 weights
        init_df()
        print("[SUCCESS] DeepFilterNet weights cached.")
    except Exception as e:
        print(f"[WARNING] DeepFilterNet caching encountered an error: {e}")
        print("The system will attempt dynamic download at runtime if needed, or use DSP fallback.")
        
    print("==================================================")
    print("Pre-baking step completed.")
    print("==================================================")

if __name__ == "__main__":
    download_models()
