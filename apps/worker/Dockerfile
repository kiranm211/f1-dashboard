FROM python:3.13-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY apps/worker/requirements.txt ./apps/worker/requirements.txt
RUN pip install --no-cache-dir -r apps/worker/requirements.txt

COPY apps/worker ./apps/worker
COPY db ./db
COPY .env.example ./.env.example

WORKDIR /app/apps/worker
CMD ["python", "-m", "src.main"]
