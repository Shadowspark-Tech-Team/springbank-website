#!/usr/bin/env bash
# =============================================================================
# Spring Bank – Developer Setup Script
#
# Usage:
#   ./scripts/setup.sh             # Full setup
#   ./scripts/setup.sh --skip-install  # Skip npm install
# =============================================================================

set -euo pipefail

# ─── Colours ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
die()     { error "$*"; exit 1; }

# ─── Parse arguments ─────────────────────────────────────────────────────────
SKIP_INSTALL=false
for arg in "$@"; do
  case "$arg" in
    --skip-install) SKIP_INSTALL=true ;;
    -h|--help)
      echo "Usage: $0 [--skip-install]"
      echo ""
      echo "Options:"
      echo "  --skip-install   Skip 'npm install' for the backend"
      echo "  -h, --help       Show this help message"
      exit 0
      ;;
    *)
      die "Unknown argument: $arg. Run '$0 --help' for usage."
      ;;
  esac
done

# ─── Resolve script / repo root ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║       Spring Bank – Setup Script         ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
echo ""

# ─── Step 1: Check Node.js version ───────────────────────────────────────────
info "Checking Node.js version..."

if ! command -v node &>/dev/null; then
  die "Node.js is not installed. Install Node 18+ from https://nodejs.org"
fi

NODE_VERSION="$(node --version)"
NODE_MAJOR="$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')"

if [ "$NODE_MAJOR" -lt 18 ]; then
  die "Node.js ${NODE_VERSION} is too old. Please install Node.js 18 or higher."
fi

success "Node.js ${NODE_VERSION} detected (≥ 18 required)"

# ─── Step 2: Check npm ───────────────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  die "npm is not available. It should be bundled with Node.js."
fi
NPM_VERSION="$(npm --version)"
success "npm ${NPM_VERSION} detected"

# ─── Step 3: Check backend directory ─────────────────────────────────────────
info "Checking backend directory..."
if [ ! -d "$BACKEND_DIR" ]; then
  die "Backend directory not found at: $BACKEND_DIR"
fi
success "Backend directory found at $BACKEND_DIR"

# ─── Step 4: Install backend dependencies ────────────────────────────────────
if [ "$SKIP_INSTALL" = true ]; then
  warn "Skipping npm install (--skip-install flag set)"
else
  info "Installing backend dependencies..."
  if [ ! -f "$BACKEND_DIR/package.json" ]; then
    die "No package.json found in $BACKEND_DIR"
  fi

  cd "$BACKEND_DIR"
  npm install --prefer-offline --no-audit 2>&1 | tail -5
  success "Backend dependencies installed"
  cd "$REPO_ROOT"
fi

# ─── Step 5: Copy .env.example → .env ────────────────────────────────────────
info "Checking environment file..."

ENV_EXAMPLE="$REPO_ROOT/.env.example"
ENV_FILE="$BACKEND_DIR/.env"

if [ ! -f "$ENV_EXAMPLE" ]; then
  warn ".env.example not found at $ENV_EXAMPLE – skipping env setup"
else
  if [ -f "$ENV_FILE" ]; then
    warn ".env already exists at $ENV_FILE – not overwriting"
  else
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    success "Copied .env.example → backend/.env"
    echo ""
    warn "ACTION REQUIRED: Edit $ENV_FILE and fill in:"
    echo -e "  ${YELLOW}•${RESET} DATABASE_URL  – your PostgreSQL connection string"
    echo -e "  ${YELLOW}•${RESET} JWT_SECRET    – run: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
    echo -e "  ${YELLOW}•${RESET} REFRESH_SECRET – same command as above (use a different value)"
    echo ""
  fi
fi

# ─── Step 6: Prisma generate ─────────────────────────────────────────────────
info "Running prisma generate..."

PRISMA_BIN="$BACKEND_DIR/node_modules/.bin/prisma"
SCHEMA_FILE="$BACKEND_DIR/prisma/schema.prisma"

if [ ! -f "$PRISMA_BIN" ]; then
  warn "Prisma CLI not found at $PRISMA_BIN"
  warn "Run 'npm install' in backend/ first, then re-run this script."
elif [ ! -f "$SCHEMA_FILE" ]; then
  warn "Prisma schema not found at $SCHEMA_FILE – skipping prisma generate"
else
  cd "$BACKEND_DIR"
  "$PRISMA_BIN" generate 2>&1 | tail -3
  success "Prisma client generated"
  cd "$REPO_ROOT"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}✔ Setup complete!${RESET}"
echo ""
echo -e "Next steps:"
echo -e "  1. Edit ${CYAN}backend/.env${RESET} with your database credentials and secrets"
echo -e "  2. Apply database migrations: ${CYAN}cd backend && npx prisma migrate deploy${RESET}"
echo -e "  3. Seed demo data:            ${CYAN}npx ts-node ../scripts/seed.ts${RESET}"
echo -e "  4. Start the dev server:      ${CYAN}npm run dev${RESET}"
echo ""
