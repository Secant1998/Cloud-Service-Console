# Cloud Service Console v3

Cloud Service Console v3 is a parallel migration of the old Tkinter console into a new stack:

- `backend/`: Python FastAPI API for SSH login, remote service control, health checks, pending-offer status, and activity logs
- `frontend/`: React + TypeScript dashboard with a modern glass / gradient desktop UI
- `src-tauri/`: minimal Tauri shell scaffold for the desktop container

The old Tkinter project is intentionally left untouched. This v3 project now uses built-in cloud defaults and no longer depends on an external `sender-cloud.config.json` file at runtime.

## Architecture

```text
Tauri shell
-> React / TypeScript frontend
-> FastAPI backend
-> Paramiko SSH + HTTP health checks
```

## Backend

The backend keeps the old business logic but moves it out of the UI layer:

- SSH login and session lifecycle
- remote `systemctl` service control
- remote service status queries
- cloud HTTP health checks
- control pending-offer inspection
- login settings persistence
- in-memory activity log

Run the backend from the `backend` folder:

```powershell
python main.py
```

By default it binds to `http://127.0.0.1:8765`.

## Frontend

Run the frontend from the `frontend` folder:

```powershell
npm install
npm run dev
```

The frontend talks to the backend through `http://127.0.0.1:8765` by default. Override with `VITE_API_BASE` if needed.

## Tauri

The first stage keeps Tauri minimal. During development:

1. start the Python backend manually
2. start the frontend dev server
3. run Tauri dev mode

For Windows packaging, the backend is bundled as a sidecar executable and started by Tauri automatically.

## Notes

- Built-in defaults:
  `publicScheme=http`, `apiPort=18081`, `sshPort=22`, `sshUser=ubuntu`
- Login settings are stored in:
  `data/cloud-console-login.json`
