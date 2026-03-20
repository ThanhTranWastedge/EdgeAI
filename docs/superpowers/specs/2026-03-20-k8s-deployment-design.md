# EdgeAI Kubernetes Deployment Design

## Overview

Migrate EdgeAI from single-server Docker Compose to Azure Kubernetes Service (AKS), following the same patterns as the AMCS Wastedge OnboardingDemo project: Azure DevOps CI pipeline, Azure Container Registry, Kustomize manifests, Istio ingress, and Cloudflare Tunnel DNS.

## Constraints & Decisions

- **Single replica** with PersistentVolume for SQLite — no database migration needed
- **Single Docker image** combining nginx (static files + SSE proxy) and uvicorn (FastAPI) via supervisord
- **Same repo** — Kustomize manifests live in `manifests/` directory alongside app code
- **Kubernetes Secrets** for env vars (SECRET_KEY, ADMIN_PASSWORD, etc.)
- **Two environment overlays**: `dev` and `prod`
- **Domain**: `edgeai.amcsgroup.io` (prod), `edgeai-dev.amcsgroup.io` (dev)
- **OpenTelemetry** observability enabled, exporting to Grafana Alloy

## Architecture

```
Internet
  │
  ├── edgeai.amcsgroup.io (Cloudflare Tunnel)
  │
  └── Istio IngressGateway
        │
        └── VirtualService → edgeai Service:80
              │
              └── Pod (1 replica)
                    ├── nginx :80 (static React SPA + /api/* proxy)
                    ├── uvicorn :8000 (FastAPI backend, localhost only)
                    ├── supervisord (process manager)
                    └── PVC mounted at /app/data (SQLite WAL)
```

## 1. Docker Image

Single multi-stage Dockerfile at repo root.

**Stage 1 — Frontend Build:**
- Base: `node:20-alpine`
- Runs `npm install` + `npm run build`
- Produces `/app/dist` (React SPA static files)

**Stage 2 — Runtime:**
- Base: `python:3.12-slim`
- Installs: nginx, supervisor, Python dependencies from `backend/requirements.txt`
- Copies:
  - Built frontend from stage 1 → `/usr/share/nginx/html`
  - Backend app code → `/app/app/`
  - `nginx-k8s.conf` (adapted for single container) → `/etc/nginx/conf.d/default.conf`
  - `supervisord.conf` → `/etc/supervisor/conf.d/`
- Exposes port 80
- Entrypoint: `supervisord`

**Supervisord configuration:**
- `nginx` — serves static files, proxies `/api/*` to `localhost:8000` with SSE headers
  - `autorestart=true`, `stdout_logfile=/dev/stdout`, `stderr_logfile=/dev/stderr`
- `uvicorn` — runs FastAPI on `localhost:8000`
  - `autorestart=true`, `stdout_logfile=/dev/stdout`, `stderr_logfile=/dev/stderr`
- `stdout_logfile_maxbytes=0` on both (disable log rotation, let K8s handle log collection)

**nginx-k8s.conf** (adapted from existing `frontend/nginx.conf`):
- Proxy target: `http://localhost:8000` instead of `http://backend:8000`
- All SSE-specific headers preserved (proxy_buffering off, Connection '', 300s timeout)

**Root `.dockerignore`:**
- `.git/`, `data/`, `.env`, `node_modules/`, `.venv/`, `__pycache__/`, `docs/`, `CLAUDE.md`, `manifests/`, `*.md`

## 2. Azure DevOps CI Pipeline

File: `azure-pipelines/ci-pipeline.yml`

```yaml
trigger:
  branches:
    include:
      - master
      - develop
  paths:
    include:
      - backend/**
      - frontend/**
      - Dockerfile
      - supervisord.conf
      - nginx-k8s.conf

name: 1.0.$(Rev:r)

pool:
  name: 'amcs-au'
  demands:
    - ImageOverride -equals ubuntu-latest

variables:
  dockerImageName: 'edgeai/edgeai-app'
  containerRegistry: 'amcsmainprdcr'

steps:
  - checkout: self
    submodules: true
    clean: true
    persistCredentials: true
    fetchDepth: 0

  - powershell: |
      $CleanSourceBranchName = "$(Build.SourceBranchName)" -Replace "[^A-Za-z0-9\-]+","-"
      $BuildNumber = "$(Build.BuildNumber)"
      if ($BuildNumber -notlike "*$($CleanSourceBranchName)") {
        $BuildNumber = "$BuildNumber-$($CleanSourceBranchName)"
        Write-Host "##vso[build.updatebuildnumber]$BuildNumber"
      }
    displayName: 'Update build number with metadata'
    condition: and(succeeded(), ne(variables['Build.SourceBranch'], 'refs/heads/master'))

  - task: Docker@2
    displayName: 'Build Docker image'
    inputs:
      command: 'build'
      Dockerfile: 'Dockerfile'
      buildContext: '.'
      repository: $(containerRegistry).azurecr.io/$(dockerImageName)
      tags: |
        $(Build.BuildNumber)

  - task: Docker@2
    displayName: 'Push image to ACR'
    inputs:
      command: 'push'
      containerRegistry: $(containerRegistry)
      repository: $(dockerImageName)
      tags: |
        $(Build.BuildNumber)

  - script: |
      echo "Docker image pushed:"
      echo "  $(containerRegistry).azurecr.io/$(dockerImageName):$(Build.BuildNumber)"
    displayName: 'Build summary'
```

**Image naming:**
- Master branch: `amcsmainprdcr.azurecr.io/edgeai/edgeai-app:1.0.42`
- Non-master: `amcsmainprdcr.azurecr.io/edgeai/edgeai-app:1.0.42-develop`

**Paths filter:** Only triggers on app code changes — docs, manifests, and markdown changes skip the build.

## 3. Kubernetes Manifests (Kustomize)

### Directory Structure

```
manifests/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── pvc.yaml
│   ├── dns.yaml
│   └── virtual-service.yaml
└── overlays/
    ├── dev/
    │   └── kustomization.yaml
    └── prod/
        └── kustomization.yaml
```

### base/deployment.yaml

- 1 replica
- Container image: `amcsmainprdcr.azurecr.io/edgeai/edgeai-app` (tag set by overlay)
- Container port: 80
- Volume mount: PVC at `/app/data`
- Resource requests/limits: `requests: 128Mi/100m`, `limits: 512Mi/500m` (tuned per overlay)
- Environment variables from Secret `edgeai-secrets`:
  - `SECRET_KEY`
  - `ADMIN_PASSWORD`
  - `ADMIN_USERNAME`
  - `DATABASE_URL`
- OpenTelemetry environment variables (inline):
  - `OTEL_SERVICE_NAME=edgeai`
  - `OTEL_EXPORTER_OTLP_ENDPOINT=http://grafana-alloy.monitoring:4318`
  - `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`
- Liveness probe: `GET /api/health` every 15s, 30s timeout, 3 failure threshold, `initialDelaySeconds: 10`
- Readiness probe: `GET /api/health` every 15s, 30s timeout, 3 failure threshold, `initialDelaySeconds: 10`
- Node selector: `purpose: generic-workload`
- Labels: `app.kubernetes.io/name: edgeai`, `app.kubernetes.io/component: web` (consistent across Deployment and Service)

### base/service.yaml

- Type: ClusterIP
- Port: 80 → container port 80
- Selector: `app.kubernetes.io/name: edgeai`

### base/pvc.yaml

- PersistentVolumeClaim
- Access mode: `ReadWriteOnce`
- Storage class: `managed-csi` (Azure Disk, explicit to avoid cluster default changes)
- Size: defined by overlay (1Gi dev, 5Gi prod)

### base/dns.yaml

- AMCS custom DNSV1 CRD
- Routes through Cloudflare Tunnel
- Record name set by overlay (e.g., `au1-edgeai-dev`, `au1-edgeai`)
- Domain: `amcsgroup.io`

### base/virtual-service.yaml

- Istio VirtualService
- Gateway: `istio-ingress/istio-ingressgateway`
- Host set by overlay
- Route to edgeai service:80

### overlays/dev/kustomization.yaml

- Namespace: `edgeai-dev`
- Image tag: set per deployment
- PVC size: 1Gi
- DNS record: `au1-edgeai-dev`, host: `edgeai-dev.amcsgroup.io`
- Resource limits: lower (128Mi/100m requests)

### overlays/prod/kustomization.yaml

- Namespace: `edgeai-prod`
- Image tag: set per deployment
- PVC size: 5Gi
- DNS record: `au1-edgeai`, host: `edgeai.amcsgroup.io`
- Resource limits: higher (256Mi/200m requests, 1Gi/1000m limits)

## 4. Health Endpoint

Already exists in `backend/app/main.py` (line 54):

```python
@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

No changes needed. K8s probes hit this through nginx (port 80 → proxy to uvicorn:8000). The `initialDelaySeconds: 10` gives supervisord time to start both nginx and uvicorn before probes begin.

## 5. OpenTelemetry Integration

**New dependencies** added to `backend/requirements.txt`:
- `opentelemetry-api`
- `opentelemetry-sdk`
- `opentelemetry-instrumentation-fastapi`
- `opentelemetry-instrumentation-httpx` (traces outbound calls to RAGFlow/OpenAI providers)
- `opentelemetry-exporter-otlp-proto-http`

**Code changes** in `app/main.py`:
- Import and call `FastAPIInstrumentor.instrument_app(app)` to auto-instrument all routes
- Import and call `HTTPXClientInstrumentor().instrument()` to trace outbound httpx calls
- Configure OTLP exporter using `OTLPSpanExporter()` (reads endpoint from `OTEL_EXPORTER_OTLP_ENDPOINT` env var automatically)
- Wrap in a guard: only initialize if `OTEL_EXPORTER_OTLP_ENDPOINT` is set (so local dev without OTel works unchanged)

## 6. Secrets Management

Kubernetes Secrets created manually per environment (not checked into git):

```bash
# Create namespaces first
kubectl create namespace edgeai-dev
kubectl create namespace edgeai-prod

# Dev secrets
kubectl create secret generic edgeai-secrets \
  --namespace=edgeai-dev \
  --from-literal=SECRET_KEY=$(openssl rand -hex 32) \
  --from-literal=ADMIN_PASSWORD=<dev-password> \
  --from-literal=ADMIN_USERNAME=admin \
  --from-literal=DATABASE_URL=sqlite+aiosqlite:////app/data/edgeai.db

# Prod secrets
kubectl create secret generic edgeai-secrets \
  --namespace=edgeai-prod \
  --from-literal=SECRET_KEY=$(openssl rand -hex 32) \
  --from-literal=ADMIN_PASSWORD=<prod-password> \
  --from-literal=ADMIN_USERNAME=admin \
  --from-literal=DATABASE_URL=sqlite+aiosqlite:////app/data/edgeai.db
```

Deployment references via `envFrom: secretRef: edgeai-secrets`.

## 7. CD / Deployment Strategy

CI builds and pushes images to ACR. Deployment to the cluster is **manual** using Kustomize:

```bash
# Deploy to dev
cd manifests/overlays/dev
kustomize edit set image amcsmainprdcr.azurecr.io/edgeai/edgeai-app:1.0.42-develop
kubectl apply -k .

# Deploy to prod
cd manifests/overlays/prod
kustomize edit set image amcsmainprdcr.azurecr.io/edgeai/edgeai-app:1.0.42
kubectl apply -k .
```

Image tag updates are committed to git so the manifests always reflect the deployed state. This is a deliberate choice — a GitOps tool (Argo CD, Flux) can be added later if needed, but manual deploys are sufficient for a small-team internal tool.

**Deployment downtime:** With 1 replica and a PVC, K8s must stop the old pod before starting the new one (the PV can only attach to one pod at a time). Expect ~10-20 seconds of downtime per deploy. Acceptable for this use case.

## 8. Istio + SSE Considerations

Istio injects an Envoy sidecar proxy, adding a proxy layer in the request path. By default, Envoy may buffer SSE responses. If SSE streaming breaks after deployment:

1. First verify: does streaming work through Istio? (Test with `curl -N`)
2. If buffered: add a `DestinationRule` to disable buffering, or annotate the pod with Istio-specific streaming hints
3. Fallback: `sidecar.istio.io/inject: "false"` annotation to bypass Istio for this pod (loses mesh features but guarantees SSE works)

This is a known risk to verify during initial deployment, not a blocker.

## 9. Files Changed / Created

| File | Action | Purpose |
|------|--------|---------|
| `Dockerfile` (root) | **New** | Combined multi-stage build (frontend + backend + nginx + supervisord) |
| `.dockerignore` (root) | **New** | Build context exclusions for root Dockerfile |
| `supervisord.conf` | **New** | Process manager config for nginx + uvicorn |
| `nginx-k8s.conf` | **New** | nginx config adapted for single container (proxy to localhost) |
| `azure-pipelines/ci-pipeline.yml` | **New** | Azure DevOps CI pipeline |
| `manifests/base/deployment.yaml` | **New** | K8s Deployment spec |
| `manifests/base/service.yaml` | **New** | K8s ClusterIP Service |
| `manifests/base/pvc.yaml` | **New** | PersistentVolumeClaim for SQLite |
| `manifests/base/dns.yaml` | **New** | Cloudflare Tunnel DNS CRD |
| `manifests/base/virtual-service.yaml` | **New** | Istio VirtualService |
| `manifests/base/kustomization.yaml` | **New** | Base Kustomize config |
| `manifests/overlays/dev/kustomization.yaml` | **New** | Dev overlay |
| `manifests/overlays/prod/kustomization.yaml` | **New** | Prod overlay |
| `backend/app/main.py` | **Modified** | Add OTel initialization (guarded by env var) |
| `backend/requirements.txt` | **Modified** | Add OpenTelemetry packages |
| `docker-compose.yml` | **Unchanged** | Kept for local development |
| `backend/Dockerfile` | **Unchanged** | Kept for local development |
| `frontend/Dockerfile` | **Unchanged** | Kept for local development |

## 10. What's NOT Changing

- Existing `docker-compose.yml` and per-service Dockerfiles remain for local development
- No database migration — SQLite stays
- No application logic changes beyond OTel init
- Health endpoint already exists — no changes needed
- Frontend code untouched
- Backend business logic untouched
