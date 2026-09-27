#!/bin/sh
set -eu

# Railway mounts volumes as root. Prepare only the upload directory, then drop privileges.
if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/uploads
  chown lms:lms /app/uploads
  exec su-exec lms:lms java -jar /app/app.jar "$@"
fi
exec java -jar /app/app.jar "$@"
