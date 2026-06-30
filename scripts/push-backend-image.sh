#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${IMAGE_NAME:-gymfixer-backend}"
DOCKERHUB_USER="${DOCKERHUB_USER:-${1:-}}"
TAG="${TAG:-latest}"
GIT_SHA="$(git -C "$ROOT_DIR" rev-parse --short HEAD)"
PUSH_SHA_TAG="${PUSH_SHA_TAG:-1}"

if [[ -z "$DOCKERHUB_USER" ]]; then
  echo "Usage: DOCKERHUB_USER=<dockerhub-user> [TAG=latest] [PUSH_SHA_TAG=1] $0"
  echo "   or: $0 <dockerhub-user>"
  exit 1
fi

LATEST_REF="${DOCKERHUB_USER}/${IMAGE_NAME}:${TAG}"
SHA_REF="${DOCKERHUB_USER}/${IMAGE_NAME}:${GIT_SHA}"

echo "Building ${LATEST_REF} from backend/Dockerfile.cpu"
docker build -f "${ROOT_DIR}/backend/Dockerfile.cpu" -t "${LATEST_REF}" "${ROOT_DIR}/backend"

echo "Pushing ${LATEST_REF}"
docker push "${LATEST_REF}"

if [[ "${PUSH_SHA_TAG}" == "1" ]]; then
  echo "Tagging ${SHA_REF}"
  docker tag "${LATEST_REF}" "${SHA_REF}"

  echo "Pushing ${SHA_REF}"
  docker push "${SHA_REF}"
fi

echo "Done"
echo "Latest tag: ${LATEST_REF}"
if [[ "${PUSH_SHA_TAG}" == "1" ]]; then
  echo "SHA tag: ${SHA_REF}"
fi
