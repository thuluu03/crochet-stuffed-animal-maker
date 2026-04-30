# Sketch Python Microservice

This service performs sketch-to-part inference in Python and is consumed by the Node backend route `POST /api/sketches/infer-parts`.

## Run locally

```bash
cd backend/sketch_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
SKETCHES_DIR="$(pwd)/../data/sketches" uvicorn app:app --host 127.0.0.1 --port 8001
```

## Environment

- `SKETCHES_DIR`: absolute path to the sketches directory (default: `<cwd>/data/sketches`)

## API

- `GET /health` -> `{ "status": "ok" }`
- `POST /infer` with body `{ "sketchPath": "IMG_2345.JPG" }` -> `{ "placedParts": [...] }`
