#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/deploy-vm.sh <frontend_repo_path> [branch] [target]
# Example:
#   ./scripts/deploy-vm.sh /opt/apps/Milestone-frontend main backend

FRONTEND_REPO_PATH="${1:-}"
BRANCH="${2:-main}"
TARGET="${3:-all}"

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
docker compose config >/dev/null

if [[ "${TARGET}" == "backend" ]]; then
  echo "[5/5] Rebuilding backend only..."
  docker compose up -d mongo redis solr
  docker compose up -d --build backend
elif [[ "${TARGET}" == "frontend" ]]; then
  echo "[5/5] Rebuilding frontend only..."
  docker compose up -d --build frontend
else
  echo "[5/5] Rebuilding full stack..."
  docker compose up -d --build --remove-orphans
fi

echo "Deployment status:"
docker compose ps

echo "Deployment completed successfully."
