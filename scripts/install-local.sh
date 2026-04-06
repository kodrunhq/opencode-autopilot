#!/usr/bin/env bash
set -euo pipefail

# ── Constants ────────────────────────────────────────────────────────────────
REPO="kodrunhq/opencode-autopilot"
INSTALL_DIR="${HOME}/.config/opencode/plugins/opencode-autopilot"
SHIM_PATH="${HOME}/.config/opencode/plugins/opencode-autopilot.ts"

# ── Temp file cleanup ────────────────────────────────────────────────────────
TMPDIR_WORK=""
cleanup() {
  if [[ -n "$TMPDIR_WORK" && -d "$TMPDIR_WORK" ]]; then
    rm -rf "$TMPDIR_WORK"
  fi
}
trap cleanup EXIT

# ── Usage ─────────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Download and install opencode-autopilot from GitHub Releases.

Options:
  -v, --version=X.Y.Z   Pin a specific release version (default: latest)
  -h, --help            Show this help message and exit

Examples:
  $(basename "$0")                   # Install latest release
  $(basename "$0") --version=1.2.3   # Install specific version
  $(basename "$0") -v 1.2.3          # Same, short form
EOF
}

# ── Arg parsing ───────────────────────────────────────────────────────────────
VERSION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --version=*)
      VERSION="${1#--version=}"
      shift
      ;;
    -v)
      if [[ -z "${2:-}" ]]; then
        echo "Error: -v requires a version argument" >&2
        exit 1
      fi
      VERSION="$2"
      shift 2
      ;;
    *)
      echo "Error: Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

# ── Download helper ───────────────────────────────────────────────────────────
# Usage: download <url> <output_file>
download() {
  local url="$1"
  local out="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -sSLf "$url" -o "$out" || {
      echo "Error: Download failed: $url" >&2
      exit 1
    }
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$out" "$url" || {
      echo "Error: Download failed: $url" >&2
      exit 1
    }
  else
    echo "Error: Neither curl nor wget found. Please install one and retry." >&2
    exit 1
  fi
}

# ── Version detection ─────────────────────────────────────────────────────────
if [[ -z "$VERSION" ]]; then
  echo "Fetching latest release version..."
  LATEST_JSON_FILE="$(mktemp)"
  download "https://api.github.com/repos/${REPO}/releases/latest" "$LATEST_JSON_FILE"
  # Parse tag_name (e.g. "v1.2.3") and strip only the leading 'v'
  TAG_NAME="$(grep -o '"tag_name": *"[^"]*"' "$LATEST_JSON_FILE" | grep -o '"[^"]*"' | tr -d '"')"
  VERSION="${TAG_NAME#v}"
  rm -f "$LATEST_JSON_FILE"
  if [[ -z "$VERSION" ]]; then
    echo "Error: Could not determine latest version from GitHub API." >&2
    exit 1
  fi
  echo "Latest version: $VERSION"
fi

# ── Construct URLs ────────────────────────────────────────────────────────────
TARBALL_NAME="opencode-autopilot-local-v${VERSION}.tar.gz"
CHECKSUM_NAME="${TARBALL_NAME}.sha256"
BASE_URL="https://github.com/${REPO}/releases/download/v${VERSION}"
TARBALL_URL="${BASE_URL}/${TARBALL_NAME}"
CHECKSUM_URL="${BASE_URL}/${CHECKSUM_NAME}"

# ── Download to temp dir ──────────────────────────────────────────────────────
TMPDIR_WORK="$(mktemp -d)"
TARBALL_FILE="${TMPDIR_WORK}/${TARBALL_NAME}"
CHECKSUM_FILE="${TMPDIR_WORK}/${CHECKSUM_NAME}"

echo "Downloading ${TARBALL_NAME}..."
download "$TARBALL_URL" "$TARBALL_FILE"

echo "Downloading checksum..."
download "$CHECKSUM_URL" "$CHECKSUM_FILE"

# ── Checksum verification ─────────────────────────────────────────────────────
echo "Verifying checksum..."
CHECKSUM_ERR="Error: Checksum verification failed. The downloaded file may be corrupt."

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$TMPDIR_WORK" && sha256sum --check --status "$CHECKSUM_NAME") || {
    echo "$CHECKSUM_ERR" >&2; exit 1
  }
elif command -v shasum >/dev/null 2>&1; then
  (cd "$TMPDIR_WORK" && shasum -a 256 --check --status "$CHECKSUM_NAME") || {
    echo "$CHECKSUM_ERR" >&2; exit 1
  }
elif command -v openssl >/dev/null 2>&1; then
  EXPECTED_DIGEST="$(awk '{print $1}' "$CHECKSUM_FILE")"
  ACTUAL_DIGEST="$(openssl dgst -sha256 "$TARBALL_FILE" | awk '{print $NF}')"
  if [[ "$EXPECTED_DIGEST" != "$ACTUAL_DIGEST" ]]; then
    echo "$CHECKSUM_ERR" >&2; exit 1
  fi
else
  echo "Error: No checksum tool found (sha256sum, shasum, or openssl required)." >&2
  exit 1
fi
echo "Checksum OK."

# ── Install (atomic: extract to staging on same filesystem, verify, then swap) ─
PLUGINS_DIR="$(dirname "$INSTALL_DIR")"
mkdir -p "$PLUGINS_DIR"
STAGING_DIR="$(mktemp -d "${PLUGINS_DIR}/.oca-staging-XXXXXX")"
echo "Extracting to staging directory..."
tar -xzf "$TARBALL_FILE" -C "$STAGING_DIR" || {
  rm -rf "$STAGING_DIR"
  echo "Error: Extraction failed. Existing installation was NOT modified." >&2
  exit 1
}

# ── Verify staging contents before swap ───────────────────────────────────────
STAGING_OK=true

for check_path in \
  "${STAGING_DIR}/src/index.ts" \
  "${STAGING_DIR}/assets" \
  "${STAGING_DIR}/node_modules"
do
  if [[ ! -e "$check_path" ]]; then
    echo "Error: Expected path missing in bundle: $check_path" >&2
    STAGING_OK=false
  fi
done
if [[ "$STAGING_OK" != "true" ]]; then
  rm -rf "$STAGING_DIR"
  echo "Error: Bundle verification failed. Existing installation was NOT modified." >&2
  exit 1
fi

# ── Swap: rename old install to backup, move staging in, remove backup ────────
BACKUP_DIR=""
if [[ -d "$INSTALL_DIR" ]]; then
  BACKUP_DIR="$(mktemp -d "${PLUGINS_DIR}/.oca-backup-XXXXXX")"
  mv "$INSTALL_DIR" "${BACKUP_DIR}/old" || {
    rm -rf "$STAGING_DIR"
    rmdir "$BACKUP_DIR" 2>/dev/null || true
    echo "Error: Could not back up existing installation." >&2
    exit 1
  }
fi
mv "$STAGING_DIR" "$INSTALL_DIR" || {
  rm -rf "$STAGING_DIR"
  if [[ -n "$BACKUP_DIR" ]]; then
    mv "${BACKUP_DIR}/old" "$INSTALL_DIR" 2>/dev/null || true
    rm -rf "$BACKUP_DIR"
  fi
  echo "Error: Could not move new installation into place." >&2
  exit 1
}
if [[ -n "$BACKUP_DIR" ]]; then
  rm -rf "$BACKUP_DIR"
fi

# ── Shim ──────────────────────────────────────────────────────────────────────
cat > "$SHIM_PATH" <<'SHIM'
export { default } from "./opencode-autopilot/src/index";
SHIM

# ── Success ───────────────────────────────────────────────────────────────────
cat <<EOF

✓ Installed opencode-autopilot v${VERSION} to ${INSTALL_DIR}

The plugin is auto-discoverable via the shim at:
  ${SHIM_PATH}

Alternatively, add to your opencode.json:
  { "plugin": ["file://${INSTALL_DIR}/src/index.ts"] }
EOF
