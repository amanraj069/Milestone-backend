# Milestone Backend (m-backend)

Express + GraphQL backend for the Milestone.

## Containerization Overview

This backend is containerized with:

- `Dockerfile`: production-ready Node.js image build
- `docker-compose.yml`: multi-container local stack (frontend + backend + MongoDB)
- `.dockerignore`: optimized Docker build context

The setup is structured for clean local development and predictable deployment behavior.

## Prerequisites

- Docker Desktop (macOS/Windows) or Docker Engine + Compose plugin (Linux)
- Port `9000` available for backend
- Port `27017` available for MongoDB
- Port `3000` available for frontend

## Quick Start (Recommended)

1. Create local environment file:

	```bash
	cp .env.example .env
	```

2. Start full stack in detached mode:

	```bash
	docker compose up -d --build
	```

3. Verify services:

	```bash
	docker compose ps
	```

4. Verify API health:

	```bash
	curl http://localhost:9000/api/health
	```

5. Stop services:

	```bash
	docker compose down
	```

6. Stop and remove DB volume too (destructive):

	```bash
	docker compose down -v
	```

## Services

### backend

- Built from local `Dockerfile`
- Runs as non-root `node` user
- Exposes port `9000`
- Depends on healthy MongoDB container
- Persists runtime-generated files:
  - `./logs` -> `/app/logs`
  - `./uploads` -> `/app/uploads`

### mongo

- Uses official `mongo:7` image
- Exposes port `27017`
- Stores data in named volume `mongo_data`
- Includes healthcheck used by backend dependency ordering

### frontend

- Built from `../Milestone-frontend/Dockerfile`
- Serves optimized Vite output via Nginx
- Exposes port `3000` on host (container port `80`)
- Uses build arg `VITE_BACKEND_URL` (default `http://localhost:9000`)

## Environment Variables

Core variables used by the backend:

- `NODE_ENV`
- `PORT`
- `FRONTEND_ORIGIN`
- `SESSION_SECRET`
- `MONGO_URL`

Optional integration variables:

- `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASS`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`

Use `.env.example` as the source of truth for names and defaults.

## Compose Commands

### Rebuild backend image

```bash
docker compose build backend
```

### Follow backend logs

```bash
docker compose logs -f backend
```

### Follow MongoDB logs

```bash
docker compose logs -f mongo
```

### Follow frontend logs

```bash
docker compose logs -f frontend
```

### Open shell in backend container

```bash
docker compose exec backend sh
```

## Security Notes

- Replace `SESSION_SECRET` before any non-local deployment.
- Replace default MongoDB credentials in `.env`.
- Keep `.env` out of version control.
- Restrict CORS origin to your actual frontend domain in production.

## Troubleshooting

### Backend cannot connect to MongoDB

- Check backend logs: `docker compose logs backend`
- Confirm `MONGO_URL` points to `mongo` service hostname
- Confirm mongo healthcheck passes: `docker compose ps`

### Port already in use

- Change host mapping in `docker-compose.yml` (for example `9001:9000`)
- Restart stack: `docker compose up -d --build`

### Clean restart

```bash
docker compose down -v
docker compose up -d --build
```

## Auto Deploy To VM (No Docker Hub)

This project supports direct VM deployment without pushing images to Docker Hub.
When you push to `main`, GitHub Actions connects to your VM over SSH, pulls latest
backend + frontend code, and runs:

```bash
docker compose up -d --build --remove-orphans
```

### Workflow File

- `.github/workflows/deploy-vm.yml`

### VM Deploy Script

- `scripts/deploy-vm.sh`

### Required GitHub Secrets

- `VM_HOST`: Public IP or hostname of your VM
- `VM_USER`: SSH user on VM
- `VM_SSH_KEY`: Private key content (PEM/OpenSSH) used by GitHub Actions
- `VM_BACKEND_PATH`: Absolute backend repo path on VM
- `VM_FRONTEND_PATH`: Absolute frontend repo path on VM

### Required VM Layout

Backend and frontend should exist as two git repos on VM. Example:

```text
/opt/apps/m-backend
/opt/apps/Milestone-frontend
```

The backend compose file builds frontend with `../Milestone-frontend`, so these paths must
be sibling-compatible in your VM layout.

### VM One-Time Setup

1. Install Docker and Docker Compose plugin.
2. Clone backend and frontend repos on VM.
3. Create backend `.env` file in backend repo path.
4. Ensure VM user can run Docker (`docker ps` works without sudo).
5. Push to `main` or run workflow manually from GitHub Actions.

### Manual Run On VM

You can run the same deployment manually:

```bash
cd /opt/apps/m-backend
./scripts/deploy-vm.sh /opt/apps/Milestone-frontend main
```
