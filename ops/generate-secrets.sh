#!/usr/bin/env bash
# Generate the secrets this deployment needs. Nothing works safely without them.
#
# JWT_SECRET   — signs Owner OS sessions. The built-in default is public in the
#                source, so anyone could mint a token for any account.
# CRON_SECRET  — authorizes both crons and the GitHub Actions heartbeat. Both
#                cron endpoints fail closed with 503 until this is set.
# MCP_ACCESS_TOKEN — bearer token for /api/mcp, the server Accio Work connects
#                to. That endpoint is also fail-closed until it is set.
#
# Usage:  ./ops/generate-secrets.sh
#
# Paste the values into Vercel (Settings → Environment Variables) and set
# CRON_SECRET to the same value in the repository's Actions secrets. Nothing is
# written to disk — do not commit the output.
set -euo pipefail

secret() { openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-48; }

cat <<EOF
JWT_SECRET=$(secret)
CRON_SECRET=$(secret)
MCP_ACCESS_TOKEN=$(secret)
EOF

echo >&2
echo "Set all three in Vercel, and CRON_SECRET again as a GitHub Actions secret." >&2
echo "These are shown once and not saved. Do not commit them." >&2
