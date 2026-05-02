# AGENT V3 Migration Guide

This project is the v3 migration target for Cloud Service Console.

## Goal

Stop iterating on the old Tkinter UI and move to:

- Tauri desktop shell
- React + TypeScript frontend
- Python FastAPI backend

## Migration Rules

- Keep SSH and cloud-control logic in Python
- Do not put `paramiko` or SSH logic in the frontend
- Keep the old Tkinter project untouched
- Build a runnable first-stage architecture before polishing packaging

## Backend Scope

The backend should preserve:

- SSH login
- remote command execution
- service start / stop
- service status query
- HTTP health checks
- pending-offer status query
- login settings persistence
- activity log

## Frontend Scope

The dashboard should include:

- login page
- sidebar
- topbar
- summary cards
- gradient metric cards
- service cards
- health panel
- connection snapshot
- activity log

## Phase Order

1. Split the backend from the old Tkinter code
2. Build the React dashboard and login screen
3. Wire the frontend to the real FastAPI API
4. Add the minimal Tauri shell
5. Polish loading, scrolling, and feedback states
