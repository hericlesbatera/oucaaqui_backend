FROM python:3.13-slim

# Install system dependencies including unrar from non-free repo
RUN apt-get update && \
    apt-get install -y \
    p7zip-full \
    libarchive-tools \
    && rm -rf /var/lib/apt/lists/*

# Install unrar from source (since it's not in Debian main)
RUN apt-get update && apt-get install -y wget ca-certificates && \
    cd /tmp && \
    wget https://www.rarlab.com/rar/unrarsrc-6.2.12.tar.gz && \
    tar -xzf unrarsrc-6.2.12.tar.gz && \
    cd unrar && \
    make -f makefile && \
    cp unrar /usr/local/bin/ && \
    cd / && rm -rf /tmp/unrar* && \
    apt-get remove -y wget && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt --no-cache-dir

# Copy application code
COPY . .

# Set Python path
ENV PYTHONPATH=/app

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

# Run the application
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
