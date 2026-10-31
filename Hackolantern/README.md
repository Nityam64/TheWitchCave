# Hackolantern - The Witch's Potion Pantry (Track 01)

## Architecture
- `backend/`: FastAPI + SQLite + AI Engine (Prophecy Forecasting, Restock Spell, Strange Happenings Anomaly Detection, Midnight Curse 3x Festival Spike).
- `web-dashboard/`: React + Tailwind + Recharts web client connected to FastAPI.
- `android-app/`: Flutter Android client connected to the same FastAPI backend.

## Quick Run
1. `cd Hackolantern/backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`
2. `cd Hackolantern/web-dashboard && npm install && npm run dev`
3. `cd Hackolantern/android-app && flutter run`
