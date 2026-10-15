# Base pinned by digest (multi-arch index). Refresh: docker buildx imagetools inspect python:3.12-slim
FROM python:3.12-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 DATA_DIR=/data
COPY requirements.txt .
# --require-hashes: every wheel must match the lock, so a tampered or swapped package fails the build
RUN pip install --no-cache-dir --require-hashes -r requirements.txt \
 && useradd --system --uid 10001 --no-create-home app \
 && mkdir -p /data && chown app /data
COPY main.py .
USER app
VOLUME /data
EXPOSE 8000
# Proxy headers are trusted only from FORWARDED_ALLOW_IPS (set in docker-compose.yml).
# Keep-alive must outlive the Next proxy agent's 5 s idle sockets, or it reuses a closed one (ECONNRESET).
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header", "--proxy-headers", "--limit-concurrency", "200", "--timeout-keep-alive", "65"]
