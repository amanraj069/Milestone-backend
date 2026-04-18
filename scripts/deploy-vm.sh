#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/deploy-vm.sh <frontend_repo_path> [branch] [target]
# Example:
#   ./scripts/deploy-vm.sh /opt/apps/Milestone-frontend main backend

FRONTEND_REPO_PATH="${1:-}"
BRANCH="${2:-main}"
TARGET="${3:-all}"
USE_SUDO_DOCKER=0

run_compose() {
  if [[ "${USE_SUDO_DOCKER}" -eq 1 ]]; then
    sudo docker compose "$@"
  else
    docker compose "$@"
  fi
}

if [[ -z "${FRONTEND_REPO_PATH}" ]]; then
  echo "Error: frontend repo path is required."
  echo "Usage: ./scripts/deploy-vm.sh <frontend_repo_path> [branch] [target]"
  exit 1
fi

if [[ ! -d "${FRONTEND_REPO_PATH}" ]]; then
  echo "Error: frontend repo path not found: ${FRONTEND_REPO_PATH}"
  exit 1
fi

if [[ ! -f "docker-compose.yml" ]]; then
  echo "Error: run this script from backend repo root (docker-compose.yml not found)."
  exit 1
fi

if [[ "${TARGET}" != "backend" && "${TARGET}" != "frontend" && "${TARGET}" != "all" ]]; then
  echo "Error: invalid target '${TARGET}'. Use one of: backend, frontend, all"
  exit 1
fi

if ! docker ps >/dev/null 2>&1; then
  if sudo -n docker ps >/dev/null 2>&1; then
    USE_SUDO_DOCKER=1
    echo "Info: docker socket requires elevated permissions, using sudo for docker compose."
  else
    echo "Error: Docker daemon is not accessible for user '${USER}'."
    echo "Fix one of these on VM:"
    echo "  1) Add user to docker group: sudo usermod -aG docker ${USER}"
    echo "  2) Allow passwordless sudo for docker commands"
    exit 1
  fi
fi

echo "[1/5] Preparing deployment target: ${TARGET}"

if [[ "${TARGET}" == "backend" || "${TARGET}" == "all" ]]; then
  echo "[2/5] Updating backend repository..."
  git fetch --all --prune
  git checkout "${BRANCH}"
  git reset --hard "origin/${BRANCH}"
fi

if [[ "${TARGET}" == "frontend" || "${TARGET}" == "all" ]]; then
  echo "[3/5] Updating frontend repository..."
  pushd "${FRONTEND_REPO_PATH}" >/dev/null
  git fetch --all --prune
  git checkout "${BRANCH}"
  git reset --hard "origin/${BRANCH}"
  popd >/dev/null
fi

echo "[4/5] Verifying Docker Compose configuration..."
run_compose config >/dev/null

if [[ "${TARGET}" == "backend" ]]; then
  echo "[5/5] Rebuilding backend only..."
  run_compose up -d mongo redis solr
  run_compose up -d --build backend
elif [[ "${TARGET}" == "frontend" ]]; then
  echo "[5/5] Rebuilding frontend only..."
  run_compose up -d --build frontend
else
  echo "[5/5] Rebuilding full stack..."
  run_compose up -d --build --remove-orphans
fi

echo "Deployment status:"
run_compose ps

echo "Deployment completed successfully."
