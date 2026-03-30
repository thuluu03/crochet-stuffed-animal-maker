# Crochet Stuffed Animal Maker

A web app for designing stuffed animals by combining 3D mesh parts on a mannequin. Designs can be colored and saved; the backend stores the finalized mesh data (points and colors).

## Features

- **Sidebar**: Preset body parts (head, body, arm, leg, ear, tail) that you can drag onto the mannequin.
- **Working area**: 3D canvas with a mannequin. Drop parts onto slots to attach them; parts snap to the correct position.
- **Resize**: Select a part (click it), then use the scale control to resize it uniformly.
- **Color**: Select a part to set its color; optional row-based colors for crochet stitch styling.
- **Save**: Saves the design to the backend (all part definitions and colors; mesh points can be extended later).

## Setup

### Backend

```bash
cd backend
npm install
npm run dev
```

Runs at `http://localhost:3001`. Designs are stored as JSON files in `backend/data/designs/`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173`. Set `VITE_API_URL=http://localhost:3001` if the API is on another host.

## API

- `POST /api/designs` – Create or update a design (body: `{ name?, parts, finalizedMeshes }`).
- `GET /api/designs` – List saved designs.
- `GET /api/designs/:id` – Get one design by id.
- `GET /api/designs/:id/pattern` – Download a plain-text crochet instruction sheet (`Content-Disposition: attachment`).

Backend tests: `cd backend && npm test`.

## Tech

- **Frontend**: Vite, React, TypeScript, Three.js, React Three Fiber, @react-three/drei.
- **Backend**: Node, Express, TypeScript; file-based JSON storage for designs.
