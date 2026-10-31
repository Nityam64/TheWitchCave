# Hackolantern - The Witch's Potion Pantry (Track 01)

## Architecture
- `backend/`: FastAPI + Firebase Firestore (with in-memory fallback) + AI Engine (Prophecy Forecasting, Restock Spell, Strange Happenings Anomaly Detection, Midnight Curse 3x Festival Spike).
- `web-dashboard/`: React + Recharts + Vite B2B Dark Store Command Center with Manager Get Started launchpad & Crystal Ball curves, plus Hexley's Potion Pantry web client connected to Cloud Firestore.
- `android-app/`: Flutter Android client with Cleartext HTTP permissions, live LAN Wi-Fi / Tunnel IP switcher, and Shelf Audit barcode simulator.
- `firestore.rules`: Security rules requiring authentication and enforcing non-negative stock counts.

## Quick Run
Run all services with a single script:
```bash
./Hackolantern/start_all.sh
```

Or run services individually:
1. **Backend (Must bind to 0.0.0.0 so phones on Wi-Fi can connect):**
   ```bash
   cd Hackolantern/backend
   pip install -r requirements.txt
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
2. **Web Dashboard:**
   ```bash
   cd Hackolantern/web-dashboard
   bun run dev   # or: npm install && npm run dev (or: python3 -m http.server 8000)
   ```
3. **Android Mobile App:**
   ```bash
   cd Hackolantern/android-app
   flutter run
   ```
   *Note:* The Flutter app features a top-right **⚙️ Server URL Settings** button to dynamically switch between your Laptop's Wi-Fi LAN IP (e.g., `http://192.168.88.35:8000`), Android Emulator (`http://10.0.2.2:8000`), or an Ngrok tunnel without needing to recompile the app.
