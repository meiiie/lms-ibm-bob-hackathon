#!/bin/sh
set -eu

# Exercise the real entrypoint with a small stand-in for Java to inspect its runtime identity.
test "$(stat -c %u /app/uploads)" = 0
mkdir /tmp/check-bin
cat > /tmp/check-bin/java <<'PROBE'
#!/bin/sh
set -eu
test "$(id -u)" = 1001
test "$1" = -jar
test "$2" = /app/app.jar
printf 'persistent upload probe' > /app/uploads/check.txt
test "$(stat -c %u /app/uploads/check.txt)" = 1001
test "$(cat /app/uploads/check.txt)" = 'persistent upload probe'
echo 'PASS: real demo entrypoint drops privileges and writes the mounted volume'
PROBE
chmod 755 /tmp/check-bin/java
export PATH="/tmp/check-bin:$PATH"
exec /app/entrypoint.sh
