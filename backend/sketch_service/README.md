# Sketch Python Microservice

This service performs sketch-to-part inference in Python and is consumed by the Node backend route `POST /api/sketches/infer-parts`.

## Run locally

If you're running this for the first time: 
```bash
cd backend/sketch_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
SKETCHES_DIR="$(pwd)/../data/sketches" uvicorn app:app --host 127.0.0.1 --port 8003
```

To activate the environment: 
```bash
cd backend/sketch_service
source .venv/bin/activate
```

To start the sketch services: 
```bash
SKETCHES_DIR="$(pwd)/../data/sketches" uvicorn app:app --host 127.0.0.1 --port 8003
```

## Environment

- `SKETCHES_DIR`: absolute path to the sketches directory (default: `<cwd>/data/sketches`)
- `DEBUG_DIR`: absolute path for debug outputs (default: `<cwd>/debug`)

## API

- `GET /health` -> `{ "status": "ok" }`
- `POST /infer` with body `{ "sketchPath": "IMG_2345.JPG" }` -> `{ "placedParts": [...] }`

## Sketch color conventions

The inference pipeline segments sketches by HSV color. Use the following colors
to tag each part:

| Part | Color | Notes |
| --- | --- | --- |
| Head | Red | Hue 0–10 / 170–179 |
| Body | Blue | Hue 100–130 |
| Arms | Green | Hue 40–85; left/right inferred from position |
| Legs | Yellow | Hue 20–35; left/right inferred from position |
| Ears | Magenta / pink | Hue 140–165; left/right inferred from position |

## Debug outputs

Each successful inference writes debug images to `DEBUG_DIR` in a timestamped folder:

- `original.png`
- `overlay_masks.png`
- `detected_contours.png`
- `labeled_parts.png`
- `pipeline.png`
