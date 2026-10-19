FROM python:3.13.16-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 DATA_DIR=/data
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
VOLUME /data
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
