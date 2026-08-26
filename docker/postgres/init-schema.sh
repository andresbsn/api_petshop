#!/bin/sh
set -e

if [ -n "$POSTGRES_SCHEMA" ]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE SCHEMA IF NOT EXISTS "$POSTGRES_SCHEMA";
EOSQL
fi
