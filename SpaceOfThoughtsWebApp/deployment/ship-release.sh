#!/usr/bin/env bash

# Copy a built release to the production host and activate it there, so shipping
# is one command instead of a copy followed by a remembered release id.
#
# With no argument the newest archive in artifacts/ is shipped, which is almost
# always the one just built. The checksum beside it travels too: spotctl refuses
# to deploy an archive whose `.sha256` sibling is missing.

set -Eeuo pipefail
IFS=$'\n\t'
umask 022

readonly DEFAULT_TARGET="jf@192.168.20.170"
readonly REMOTE_DIR="/tmp"

die() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

warn() {
    printf 'WARNING: %s\n' "$*" >&2
}

info() {
    printf '==> %s\n' "$*"
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

usage() {
    cat <<'EOF'
Usage: ship-release.sh [ARCHIVE]

Copies a release archive and its checksum to the production host, then runs
`sudo spotctl deploy` there. Without ARCHIVE the newest archive in artifacts/
is used.

Environment:
  SPOT_TARGET   Override the ssh destination (default: jf@192.168.20.170)
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

require_command scp
require_command ssh

# Resolve all paths from this file, so the command works from any directory.
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd -P)"
readonly ARTIFACTS_DIR="$REPO_ROOT/artifacts"
readonly TARGET="${SPOT_TARGET:-$DEFAULT_TARGET}"

if [[ $# -ge 1 ]]; then
    ARCHIVE="$1"
else
    [[ -d "$ARTIFACTS_DIR" ]] || die "No artifacts directory yet: $ARTIFACTS_DIR"
    # Newest first; the build writes the archive only once it is complete.
    ARCHIVE="$(ls -1t -- "$ARTIFACTS_DIR"/spaceofthoughts-*.tar.gz 2>/dev/null | head -n 1 || true)"
    [[ -n "$ARCHIVE" ]] || die "No release archive found in $ARTIFACTS_DIR. Run build-release.sh first."
fi

[[ -f "$ARCHIVE" ]] || die "Release archive not found: $ARCHIVE"
readonly ARCHIVE
readonly CHECKSUM="${ARCHIVE}.sha256"
[[ -f "$CHECKSUM" ]] || die "Release checksum not found beside the archive: $CHECKSUM"

readonly ARCHIVE_NAME="$(basename -- "$ARCHIVE")"
readonly REMOTE_ARCHIVE="$REMOTE_DIR/$ARCHIVE_NAME"

# ----- One authentication for the whole run -----
#
# The copy, the deploy, and the cleanup below are three separate SSH sessions,
# so a password login would be typed three times. Opening one master connection
# up front and routing the rest through its socket reduces that to a single
# authentication. Key-based logins gain the speed but see no prompt either way.
#
# ControlPath is always passed: if the master could not be opened, the socket
# simply does not exist and each command falls back to connecting on its own.

SOCKET_DIR="$(mktemp -d "${TMPDIR:-/tmp}/spot-ship.XXXXXXXX")" ||
    die "Unable to create a temporary directory for the SSH control socket."
readonly SOCKET_DIR
readonly CONTROL_PATH="$SOCKET_DIR/mux"
readonly SSH_MUX_OPTS=(-o "ControlPath=$CONTROL_PATH")

cleanup_master_connection() {
    local exit_code=$?

    # Ask the master to exit so no connection outlives this script.
    if [[ -S "$CONTROL_PATH" ]]; then
        ssh -O exit "${SSH_MUX_OPTS[@]}" "$TARGET" >/dev/null 2>&1 || true
    fi
    if [[ -d "$SOCKET_DIR" ]]; then
        rm -rf -- "$SOCKET_DIR"
    fi

    exit "$exit_code"
}
trap cleanup_master_connection EXIT
trap 'exit 130' INT TERM

# -f backgrounds the master only after authentication succeeds, so any password
# prompt is answered here rather than partway through shipping.
info "Connecting to $TARGET"
if ! ssh -f -N -M "${SSH_MUX_OPTS[@]}" "$TARGET"; then
    warn "Could not open a shared connection; each step will authenticate separately."
fi

# Catch a mistyped or stale artifact before it reaches the Pi.
if command -v sha256sum >/dev/null 2>&1; then
    info "Verifying the archive checksum locally"
    (cd -- "$(dirname -- "$ARCHIVE")" && sha256sum --check --status "$(basename -- "$CHECKSUM")") ||
        die "Local checksum verification failed for $ARCHIVE_NAME"
fi

info "Copying $ARCHIVE_NAME to $TARGET:$REMOTE_DIR"
scp "${SSH_MUX_OPTS[@]}" -- "$ARCHIVE" "$CHECKSUM" "$TARGET:$REMOTE_DIR/"

# `deploy` prompts for the sudo password and reports progress, so it needs a
# terminal on the remote side. That sudo prompt is the host's own and is not
# affected by how many SSH connections this script opens.
info "Deploying on $TARGET"
ssh -t "${SSH_MUX_OPTS[@]}" "$TARGET" "sudo spotctl deploy '$REMOTE_ARCHIVE'"

# Only tidy up once the release is installed; a failed deploy is worth retrying
# without copying the archive across the network again.
info "Removing the copies from $TARGET:$REMOTE_DIR"
ssh "${SSH_MUX_OPTS[@]}" "$TARGET" "rm -f -- '$REMOTE_ARCHIVE' '$REMOTE_ARCHIVE.sha256'"

printf '\nShipped successfully:\n  Archive: %s\n  Host:    %s\n' \
    "$ARCHIVE_NAME" \
    "$TARGET"
