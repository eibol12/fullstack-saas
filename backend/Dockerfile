# Use the slim version of Python 3.13 for a smaller, faster image
FROM python:3.13-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies (required for some Python packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . /app/

# Create necessary directories for Media and Static files
RUN mkdir -p /app/staticfiles /app/media

# Build-time task: Collect static files
# We use the dummy key you identified in your settings.py
RUN DJANGO_SECRET_KEY=build-time-dummy-key-for-static-files \
    python manage.py collectstatic --noinput

# Expose the port (Railway will provide the actual port via $PORT)
EXPOSE 8000

# Fallback command (Railway will override this if you set the 'Start Command' in the UI)
CMD ["gunicorn", "web_rigging_program.wsgi:application", "--bind", "0.0.0.0:8000"]