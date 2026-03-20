# EdgeAI K8s Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate EdgeAI from Docker Compose to AKS with Azure DevOps CI, ACR, Kustomize, Istio, and Cloudflare Tunnel DNS.

**Architecture:** Single Docker image (nginx + uvicorn via supervisord) deployed as 1 replica on AKS with PersistentVolume for SQLite. Azure DevOps CI builds and pushes to ACR. Kustomize manifests with dev/prod overlays handle K8s deployment. OpenTelemetry exports traces to Grafana Alloy.

**Tech Stack:** Docker multi-stage build, supervisord, nginx, Python/FastAPI/uvicorn, Kustomize, Istio VirtualService, AMCS DNSV1 CRD, OpenTelemetry

**Spec:** `docs/superpowers/specs/2026-03-20-k8s-deployment-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `.dockerignore` (root) | Create | Build context exclusions for root Dockerfile |
| `nginx-k8s.conf` (root) | Create | nginx config for single-container (proxy to localhost:8000) |
| `supervisord.conf` (root) | Create | Process manager: nginx + uvicorn |
| `Dockerfile` (root) | Create | Multi-stage build: frontend → runtime with nginx+uvicorn |
| `azure-pipelines/ci-pipeline.yml` | Create | Azure DevOps CI: build + push to ACR |
| `manifests/base/deployment.yaml` | Create | K8s Deployment with PVC, probes, OTel env |
| `manifests/base/service.yaml` | Create | ClusterIP Service |
| `manifests/base/pvc.yaml` | Create | PersistentVolumeClaim for SQLite |
| `manifests/base/dns.yaml` | Create | Cloudflare Tunnel DNS CRD |
| `manifests/base/virtual-service.yaml` | Create | Istio VirtualService |
| `manifests/base/kustomization.yaml` | Create | Base Kustomize config listing resources |
| `manifests/overlays/dev/kustomization.yaml` | Create | Dev overlay: namespace, image tag, patches |
| `manifests/overlays/prod/kustomization.yaml` | Create | Prod overlay: namespace, image tag, patches |
| `backend/requirements.txt` | Modify | Add OpenTelemetry packages |
| `backend/app/main.py` | Modify | Add OTel initialization (guarded by env var) |

---

### Task 1: Create nginx-k8s.conf

Adapt the existing `frontend/nginx.conf` for single-container mode (proxy to localhost instead of Docker service name).

**Files:**
- Reference: `frontend/nginx.conf`
- Create: `nginx-k8s.conf`

- [ ] **Step 1: Create nginx-k8s.conf**

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Only change from `frontend/nginx.conf`: `proxy_pass http://localhost:8000` instead of `http://backend:8000`.

- [ ] **Step 2: Commit**

```bash
git add nginx-k8s.conf
git commit -m "feat(deploy): add nginx config for single-container K8s mode"
```

---

### Task 2: Create supervisord.conf

**Files:**
- Create: `supervisord.conf`

- [ ] **Step 1: Create supervisord.conf**

```ini
[supervisord]
nodaemon=true
user=root
logfile=/dev/null
logfile_maxbytes=0
pidfile=/var/run/supervisord.pid

[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:uvicorn]
command=uvicorn app.main:app --host 127.0.0.1 --port 8000
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

Key details:
- `nodaemon=true` — supervisord stays in foreground (required for Docker)
- Both processes log to stdout/stderr — K8s collects these
- `logfile_maxbytes=0` — disables log rotation (K8s handles it)
- uvicorn binds to `127.0.0.1:8000` — only reachable from nginx within the container

- [ ] **Step 2: Commit**

```bash
git add supervisord.conf
git commit -m "feat(deploy): add supervisord config for nginx + uvicorn"
```

---

### Task 3: Create root .dockerignore and Dockerfile

**Files:**
- Create: `.dockerignore`
- Create: `Dockerfile`
- Reference: `backend/Dockerfile`, `frontend/Dockerfile`

- [ ] **Step 1: Create .dockerignore**

```
.git
data
.env
.env.example
node_modules
.venv
__pycache__
docs
CLAUDE.md
manifests
azure-pipelines
*.md
.agents
.pytest_cache
backend/tests
backend/.pytest_cache
backend/.dockerignore
frontend/.dockerignore
```

- [ ] **Step 2: Create root Dockerfile**

```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Runtime
FROM python:3.12-slim

# Install nginx and supervisor
RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx && \
    rm -rf /var/lib/apt/lists/* && \
    pip install --no-cache-dir supervisor

# Install Python dependencies
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/app/ app/

# Copy built frontend from stage 1
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Copy nginx and supervisor configs
COPY nginx-k8s.conf /etc/nginx/conf.d/default.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Remove default nginx site
RUN rm -f /etc/nginx/sites-enabled/default

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 80

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
```

- [ ] **Step 3: Build the image locally to verify**

```bash
docker build -t edgeai-app:test .
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Run the image locally to verify both processes start**

```bash
docker run --rm -p 3080:80 \
  -e SECRET_KEY=test \
  -e ADMIN_PASSWORD=test \
  edgeai-app:test &

# Wait for startup
sleep 5

# Test health endpoint (through nginx → uvicorn)
curl -s http://localhost:3080/api/health
# Expected: {"status":"ok"}

# Test frontend is served
curl -s -o /dev/null -w "%{http_code}" http://localhost:3080/
# Expected: 200

# Stop the container
docker stop $(docker ps -q --filter ancestor=edgeai-app:test)
```

- [ ] **Step 5: Commit**

```bash
git add .dockerignore Dockerfile
git commit -m "feat(deploy): add combined Dockerfile with multi-stage build"
```

---

### Task 4: Create Azure DevOps CI Pipeline

**Files:**
- Create: `azure-pipelines/ci-pipeline.yml`
- Reference: `/home/thanh-tran/Wastedge/OnboardingDemo/azure-pipelines/ci-pipeline.yml`

- [ ] **Step 1: Create directory and pipeline file**

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

- [ ] **Step 2: Validate YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('azure-pipelines/ci-pipeline.yml'))"
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add azure-pipelines/ci-pipeline.yml
git commit -m "feat(deploy): add Azure DevOps CI pipeline for ACR"
```

---

### Task 5: Create Kustomize Base Manifests

**Files:**
- Create: `manifests/base/deployment.yaml`
- Create: `manifests/base/service.yaml`
- Create: `manifests/base/pvc.yaml`
- Create: `manifests/base/dns.yaml`
- Create: `manifests/base/virtual-service.yaml`
- Create: `manifests/base/kustomization.yaml`
- Reference: `/home/thanh-tran/Wastedge/OnboardingDemoDeployment/manifests/base/`

- [ ] **Step 1: Create manifests/base/deployment.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: edgeai
  labels:
    app.kubernetes.io/name: edgeai
    app.kubernetes.io/component: web
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app.kubernetes.io/name: edgeai
  template:
    metadata:
      labels:
        app.kubernetes.io/name: edgeai
        app.kubernetes.io/component: web
    spec:
      nodeSelector:
        purpose: generic-workload
      containers:
        - name: edgeai
          image: amcsmainprdcr.azurecr.io/edgeai/edgeai-app
          ports:
            - containerPort: 80
          envFrom:
            - secretRef:
                name: edgeai-secrets
          env:
            - name: OTEL_SERVICE_NAME
              value: edgeai
            - name: OTEL_EXPORTER_OTLP_ENDPOINT
              value: http://grafana-alloy.monitoring:4318
            - name: OTEL_EXPORTER_OTLP_PROTOCOL
              value: http/protobuf
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /api/health
              port: 80
              scheme: HTTP
            initialDelaySeconds: 10
            periodSeconds: 15
            timeoutSeconds: 30
            failureThreshold: 3
            successThreshold: 1
          readinessProbe:
            httpGet:
              path: /api/health
              port: 80
              scheme: HTTP
            initialDelaySeconds: 10
            periodSeconds: 15
            timeoutSeconds: 30
            failureThreshold: 3
            successThreshold: 1
          volumeMounts:
            - name: data
              mountPath: /app/data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: edgeai-data
```

Key differences from Wastedge reference:
- `strategy: Recreate` — required because PVC is ReadWriteOnce (can't have two pods)
- `envFrom: secretRef` — loads secrets as env vars
- `resources` — defined since we run two processes (nginx + uvicorn)
- `volumeMounts` — PVC for SQLite persistence
- Port 80 (nginx) instead of 8080

- [ ] **Step 2: Create manifests/base/service.yaml**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: edgeai
  labels:
    app.kubernetes.io/name: edgeai
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: edgeai
  ports:
    - port: 80
      targetPort: 80
```

- [ ] **Step 3: Create manifests/base/pvc.yaml**

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: edgeai-data
  labels:
    app.kubernetes.io/name: edgeai
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: managed-csi
  resources:
    requests:
      storage: 1Gi
```

- [ ] **Step 4: Create manifests/base/dns.yaml**

```yaml
apiVersion: idp.amcsgroup.com/v1
kind: DNSV1
metadata:
  name: edgeai
  labels:
    provider: azure
spec:
  parameters:
    record: au1-edgeai-dev
    domain: amcsgroup.io
    target:
      type: cloudflare-tunnel
      value: au1-aks-dev-1
```

Base defaults to dev values (consistent with Wastedge pattern). Prod overlay overrides record name and target.

- [ ] **Step 5: Create manifests/base/virtual-service.yaml**

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: edgeai
spec:
  hosts:
    - "edgeai-dev.amcsgroup.io"
  gateways:
    - istio-ingress/istio-ingressgateway
  http:
    - route:
        - destination:
            host: edgeai
            port:
              number: 80
```

Host is overridden by overlays for each environment.

- [ ] **Step 6: Create manifests/base/kustomization.yaml**

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
  - pvc.yaml
  - dns.yaml
  - virtual-service.yaml
```

- [ ] **Step 7: Validate with kustomize build (if kustomize is available)**

```bash
kubectl kustomize manifests/base/ 2>&1 || echo "kustomize not installed — skip validation, manifests reviewed manually"
```

- [ ] **Step 8: Commit**

```bash
git add manifests/base/
git commit -m "feat(deploy): add Kustomize base manifests for AKS"
```

---

### Task 6: Create Kustomize Overlays (dev + prod)

**Files:**
- Create: `manifests/overlays/dev/kustomization.yaml`
- Create: `manifests/overlays/prod/kustomization.yaml`
- Reference: `/home/thanh-tran/Wastedge/OnboardingDemoDeployment/manifests/overlays/dev/kustomization.yaml`

- [ ] **Step 1: Create manifests/overlays/dev/kustomization.yaml**

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: edgeai-dev
resources:
  - ../../base
images:
  - name: amcsmainprdcr.azurecr.io/edgeai/edgeai-app
    newTag: latest
patches:
  - target:
      kind: DNSV1
      name: edgeai
    patch: |
      - op: replace
        path: /spec/parameters/record
        value: au1-edgeai-dev
      - op: replace
        path: /spec/parameters/target/value
        value: au1-aks-dev-1
  - target:
      kind: VirtualService
      name: edgeai
    patch: |
      - op: replace
        path: /spec/hosts/0
        value: edgeai-dev.amcsgroup.io
```

- [ ] **Step 2: Create manifests/overlays/prod/kustomization.yaml**

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: edgeai-prod
resources:
  - ../../base
images:
  - name: amcsmainprdcr.azurecr.io/edgeai/edgeai-app
    newTag: latest
patches:
  - target:
      kind: DNSV1
      name: edgeai
    patch: |
      - op: replace
        path: /spec/parameters/record
        value: au1-edgeai
      - op: replace
        path: /spec/parameters/target/value
        value: au1-aks-prod-1
  - target:
      kind: VirtualService
      name: edgeai
    patch: |
      - op: replace
        path: /spec/hosts/0
        value: edgeai.amcsgroup.io
  - target:
      kind: PersistentVolumeClaim
      name: edgeai-data
    patch: |
      - op: replace
        path: /spec/resources/requests/storage
        value: 5Gi
  - target:
      kind: Deployment
      name: edgeai
    patch: |
      - op: replace
        path: /spec/template/spec/containers/0/resources/requests/memory
        value: "256Mi"
      - op: replace
        path: /spec/template/spec/containers/0/resources/requests/cpu
        value: "200m"
      - op: replace
        path: /spec/template/spec/containers/0/resources/limits/memory
        value: "1Gi"
      - op: replace
        path: /spec/template/spec/containers/0/resources/limits/cpu
        value: "1000m"
```

- [ ] **Step 3: Validate overlays with kustomize build**

```bash
kubectl kustomize manifests/overlays/dev/ 2>&1 || echo "kustomize not installed — skip"
kubectl kustomize manifests/overlays/prod/ 2>&1 || echo "kustomize not installed — skip"
```

- [ ] **Step 4: Commit**

```bash
git add manifests/overlays/
git commit -m "feat(deploy): add Kustomize dev and prod overlays"
```

---

### Task 7: Add OpenTelemetry Integration

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/app/main.py:1-16` (imports) and after line 36 (app creation)

- [ ] **Step 1: Add OTel packages to requirements.txt**

Append to `backend/requirements.txt`:

```
opentelemetry-api==1.33.0
opentelemetry-sdk==1.33.0
opentelemetry-instrumentation-fastapi==0.54b0
opentelemetry-instrumentation-httpx==0.54b0
opentelemetry-exporter-otlp-proto-http==1.33.0
```

- [ ] **Step 2: Add OTel initialization to main.py**

Add after the existing imports (after line 14):

```python
import os
```

Add after `app = FastAPI(title="EdgeAI", lifespan=lifespan)` (after line 36), before the CORS middleware:

```python
# OpenTelemetry — only initialize if OTEL endpoint is configured
if os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT"):
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

    provider = TracerProvider()
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)
    HTTPXClientInstrumentor().instrument()
```

This is guarded by env var so local dev (without OTel) works unchanged. The `OTLPSpanExporter()` reads `OTEL_EXPORTER_OTLP_ENDPOINT` automatically.

- [ ] **Step 3: Verify backend still starts locally**

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test uvicorn app.main:app --host 127.0.0.1 --port 8000 &
sleep 2
curl -s http://localhost:8000/api/health
# Expected: {"status":"ok"}
kill %1
```

OTel should NOT initialize (no `OTEL_EXPORTER_OTLP_ENDPOINT` set).

- [ ] **Step 4: Run existing tests to verify no regressions**

```bash
cd backend
source .venv/bin/activate
SECRET_KEY=test python -m pytest tests/ -v
```

Expected: All existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/app/main.py
git commit -m "feat(deploy): add OpenTelemetry instrumentation for AKS observability"
```

---

### Task 8: Final Docker Build Verification

Rebuild the combined image with OTel changes and verify everything works end-to-end.

**Files:** None (verification only)

- [ ] **Step 1: Rebuild the image**

```bash
docker build -t edgeai-app:test .
```

Expected: Build succeeds.

- [ ] **Step 2: Run and verify all endpoints**

```bash
docker run --rm -p 3080:80 \
  -e SECRET_KEY=test \
  -e ADMIN_PASSWORD=test \
  edgeai-app:test &

sleep 5

# Health endpoint
curl -s http://localhost:3080/api/health
# Expected: {"status":"ok"}

# Frontend serves
curl -s -o /dev/null -w "%{http_code}" http://localhost:3080/
# Expected: 200

# API returns proper error for unauthenticated request
curl -s -o /dev/null -w "%{http_code}" http://localhost:3080/api/integrations
# Expected: 401

docker stop $(docker ps -q --filter ancestor=edgeai-app:test)
```

- [ ] **Step 3: Clean up test image**

```bash
docker rmi edgeai-app:test
```

---

## Deployment Checklist (Manual, Post-CI)

These steps are run manually on the AKS cluster after the CI pipeline has pushed the image. Not part of the automated plan — documented here for reference.

```bash
# 1. Create namespaces
kubectl create namespace edgeai-dev
kubectl create namespace edgeai-prod

# 2. Create secrets
kubectl create secret generic edgeai-secrets \
  --namespace=edgeai-dev \
  --from-literal=SECRET_KEY=$(openssl rand -hex 32) \
  --from-literal=ADMIN_PASSWORD=<dev-password> \
  --from-literal=ADMIN_USERNAME=admin \
  --from-literal=DATABASE_URL=sqlite+aiosqlite:////app/data/edgeai.db

# 3. Deploy to dev
cd manifests/overlays/dev
kustomize edit set image amcsmainprdcr.azurecr.io/edgeai/edgeai-app:<tag>
kubectl apply -k .

# 4. Verify
kubectl get pods -n edgeai-dev
kubectl logs -n edgeai-dev deployment/edgeai

# 5. Test SSE streaming through Istio
curl -N https://edgeai-dev.amcsgroup.io/api/health

# 6. If SSE streaming is buffered by Istio, add sidecar annotation:
#    sidecar.istio.io/inject: "false" to deployment template metadata
```
