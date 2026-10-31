# Hackolantern - The Witch's Potion Pantry (Track 01)

## Architecture
- `backend/`: FastAPI + SQLite + AI Engine (Prophecy Forecasting, Restock Spell, Strange Happenings Anomaly Detection, Midnight Curse 3x Festival Spike).
- `web-dashboard/`: Hexley's Potion Pantry web client connected to Cloud Firestore (with local demo storage fallback), featuring inventory management, atomic sale recording, 7-day demand forecasting with 3x festival surges, unusual consumption alerts, and suppliers.
- `android-app/`: Flutter & Capacitor Android client configuration for the witch's pantry.
- `firestore.rules`: Security rules requiring authentication and enforcing non-negative stock counts.

## Quick Run
1. `cd Hackolantern/backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`
2. `cd Hackolantern/web-dashboard && python3 -m http.server 8000` (or `npm run dev`)
3. `cd Hackolantern/android-app && flutter run`
