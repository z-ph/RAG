#!/bin/bash
set -euo pipefail

# MySQL initialization and startup script

MYSQL_DATA_DIR="/var/lib/mysql"
MYSQL_SOCKET="/var/run/mysqld/mysqld.sock"
MYSQL_PID_FILE="/var/run/mysqld/mysqld.pid"

# Initialize MySQL data directory if empty
if [ ! -d "$MYSQL_DATA_DIR/mysql" ]; then
    echo "Initializing MySQL data directory..."
    mysqld --initialize-insecure --user=mysql --datadir="$MYSQL_DATA_DIR"
fi

# Ensure socket directory exists
mkdir -p /var/run/mysqld
chown mysql:mysql /var/run/mysqld

# Start MySQL temporarily for setup
mysqld --user=mysql --socket="$MYSQL_SOCKET" --skip-networking &
MYSQL_PID=$!

# Wait for MySQL to be ready
echo "Waiting for MySQL to start..."
for i in {1..60}; do
    if mysqladmin ping -S "$MYSQL_SOCKET" --silent 2>/dev/null; then
        break
    fi
    sleep 1
done

# Perform initial setup
if [ -n "${MYSQL_ROOT_PASSWORD:-}" ]; then
    echo "Setting MySQL root password..."
    mysql -S "$MYSQL_SOCKET" -u root <<EOF
ALTER USER 'root'@'localhost' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD}';
EOF
    ROOT_AUTH="-u root -p${MYSQL_ROOT_PASSWORD}"
else
    ROOT_AUTH="-u root"
fi

# Create database if specified
if [ -n "${MYSQL_DATABASE:-}" ]; then
    echo "Creating database ${MYSQL_DATABASE}..."
    mysql -S "$MYSQL_SOCKET" $ROOT_AUTH -e "CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\`;"
fi

# Create user and grant permissions
if [ -n "${MYSQL_USER:-}" ] && [ -n "${MYSQL_PASSWORD:-}" ]; then
    echo "Creating user ${MYSQL_USER}..."
    mysql -S "$MYSQL_SOCKET" $ROOT_AUTH -e "CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'%' IDENTIFIED BY '${MYSQL_PASSWORD}';"

    if [ -n "${MYSQL_DATABASE:-}" ]; then
        mysql -S "$MYSQL_SOCKET" $ROOT_AUTH -e "GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_USER}'@'%';"
    fi

    mysql -S "$MYSQL_SOCKET" $ROOT_AUTH -e "FLUSH PRIVILEGES;"
fi

# Update root access for remote connections if needed
if [ "${MYSQL_ROOT_HOST:-}" = "%" ]; then
    echo "Configuring remote root access..."
    mysql -S "$MYSQL_SOCKET" $ROOT_AUTH -e "CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD}'; GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION; FLUSH PRIVILEGES;" || true
fi

# Shutdown temporary instance
mysqladmin -S "$MYSQL_SOCKET" $ROOT_AUTH shutdown 2>/dev/null || true
kill $MYSQL_PID 2>/dev/null || true
wait $MYSQL_PID 2>/dev/null || true

echo "MySQL initialization complete. Starting mysqld..."

# Start MySQL normally with network access
exec mysqld --user=mysql --datadir="$MYSQL_DATA_DIR" --socket="$MYSQL_SOCKET" --bind-address=0.0.0.0
