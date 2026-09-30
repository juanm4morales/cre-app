FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/requirements.txt \
    && groupadd --gid 10001 creapp \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin creapp \
    && install -d -o 10001 -g 10001 /app/backend/staticfiles

COPY . /app
USER 10001:10001
EXPOSE 8000
CMD ["gunicorn", "--chdir", "/app/backend", "--workers", "1", "--bind", "0.0.0.0:8000", "--access-logfile", "-", "--error-logfile", "-", "config.wsgi:application"]
