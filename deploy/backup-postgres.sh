#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="$project_dir/docker-compose.production.yml"
backup_dir="${SHADOWPM_BACKUP_DIR:-/opt/shadowpm-backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$backup_dir/shadowpm-$timestamp.sql.gz"
temporary_file="$backup_file.tmp"

mkdir -p "$backup_dir"
umask 077

docker compose --env-file "$project_dir/.env.production" -f "$compose_file" exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip -9 > "$temporary_file"

mv "$temporary_file" "$backup_file"
sha256sum "$backup_file" > "$backup_file.sha256"
find "$backup_dir" -type f -name 'shadowpm-*.sql.gz' -mtime +14 -delete
find "$backup_dir" -type f -name 'shadowpm-*.sql.gz.sha256' -mtime +14 -delete

printf 'Backup created: %s\n' "$backup_file"
