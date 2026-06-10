# DEAL Audio Quality Assessment Dashboard

A secure, offline-ready, and high-performance dashboard for audio resynthesis, noise injection, and objective speech quality measurements. Specially engineered for the air-gapped, high-security operating environments of DEAL (DRDO).

---

## Architecture Overview

- **NGINX**: Front-line secure reverse proxy handling TLS/HTTPS termination, strict rate limiting (5r/s), and request routing.
- **Vite + React**: Premium dark-mode dashboard running 100% inside browser context for responsive audio SVG overlays and time-frequency Canvas spectrogram rendering.
- **FastAPI**: Asynchronous high-performance computation engine running digital resampling layers (poly-phase filters) and KPI scoring indices.
- **PostgreSQL**: Robust, transaction-safe storage for user role accounts and quality assessment runs audit logs.

---

## Getting Started: Dynamic Dual-Mode Operations

To satisfy varying developer setups, the system features **automatic environment detection**:

### Option 1: Live Local Developer Run (SQLite Fallback)
This mode requires no Docker installation and fallback-seeds a local SQLite database file `deal_dashboard.db` automatically in the backend.

#### 1. Start the FastAPI Backend Service:
Make sure you have Python 3.10+ installed. Open a terminal inside `/backend`:
```bash
# Install dependencies
pip install -r requirements.txt

# Run server with live reloading
python -m uvicorn app.main:app --reload --port 8000
```
FastAPI runs on `http://localhost:8000`.

#### 2. Start the Vite React Frontend:
Open a terminal inside `/frontend`:
```bash
# Install packages
npm install

# Start Vite hot-reload server
npm run dev
```
Open your browser to `http://localhost:3000`. The Vite server automatically proxies `/api` calls directly to `http://localhost:8000/api` without CORS checks!

---

### Option 2: Production Containerized Run (Docker Compose)
This spins up the production-hardened multi-container network.

Run a single command from the project root folder:
```bash
docker compose up --build
```
Once the containers finish compiling, visit **`https://localhost`** in your web browser. NGINX will serve the secure connection over port 443 with dynamically generated secure local certificates.

---

## Seed Accounts (Immediate Testing)
The application automatically seeds three authorization roles into database tables on initial start:

| Role Level | Username | Password | Actions Available |
| :--- | :--- | :--- | :--- |
| **Administrator** | `pragya` | `deal@123` | Control directory accounts, rotate passwords, manage roles, view all logs. |
| **Supervisor** | `supervisor` | `supervisor123` | Filter quality audit tables, view analyst summaries, export offline CSV reports. |
| **Analyst** | `analyst` | `analyst123` | Upload WAV speech, configure interference SNR, run calculations. |

---

## Resampling Safety Layer Specification
The DEAL quality assessment engine strictly routes uploaded signals through standard decimation filters before processing metric libraries to ensure complete calculation stability:

1. **Signal-to-Noise (SNR)**: RMS calculations evaluated at original sampling rate.
2. **PESQ (Mean Opinion Score)**: Automated fractional downsampling using `scipy.signal.resample_poly` to **16000 Hz** (wide-band MOS models) to avoid standard library crash signatures.
3. **STOI (Intelligibility Index)**: Decimated/resampled to **16000 Hz** (wide-band spectrum) to maintain alignment with standard objective scoring ranges. 
