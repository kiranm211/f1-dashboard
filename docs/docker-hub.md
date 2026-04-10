# Docker Hub Push Guide

This project publishes two runtime images:

- API image from `apps/api/Dockerfile`
- Worker image from `apps/worker/Dockerfile`

## 1. Build images

Run from repository root:

```powershell
docker build -f apps/api/Dockerfile -t <dockerhub-username>/f1-dashboard-api:latest .
docker build -f apps/worker/Dockerfile -t <dockerhub-username>/f1-dashboard-worker:latest .
```

Optional versioned tags:

```powershell
docker tag <dockerhub-username>/f1-dashboard-api:latest <dockerhub-username>/f1-dashboard-api:v0.1.0
docker tag <dockerhub-username>/f1-dashboard-worker:latest <dockerhub-username>/f1-dashboard-worker:v0.1.0
```

## 2. Login to Docker Hub

```powershell
docker login
```

## 3. Push images

```powershell
docker push <dockerhub-username>/f1-dashboard-api:latest
docker push <dockerhub-username>/f1-dashboard-worker:latest
```

If using version tags, push those too:

```powershell
docker push <dockerhub-username>/f1-dashboard-api:v0.1.0
docker push <dockerhub-username>/f1-dashboard-worker:v0.1.0
```

## 4. Pull and run

```powershell
docker pull <dockerhub-username>/f1-dashboard-api:latest
docker pull <dockerhub-username>/f1-dashboard-worker:latest
```

Run the API container:

```powershell
docker run --rm -p 4000:4000 --env-file .env <dockerhub-username>/f1-dashboard-api:latest
```

Run the worker container:

```powershell
docker run --rm --env-file .env <dockerhub-username>/f1-dashboard-worker:latest
```
