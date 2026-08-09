#!/usr/bin/env bash

# Build one production release containing both deployable applications:
#   - the self-contained ASP.NET Core API for 64-bit Linux ARM
#   - the Angular browser application served by Nginx
#
# The resulting archive is data-only. It contains published output and a JSON
# manifest, but never copies the repository, environment files, or source tree.

set -Eeuo pipefail
IFS=$'\n\t'
umask 022

readonly RID="linux-arm64"
readonly API_EXECUTABLE_PATH="api/SpaceOfThoughts.API"
readonly UI_ROOT_PATH="ui/browser"
readonly MANIFEST_PATH="release-manifest.json"

die() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

info() {
    printf '==> %s\n' "$*"
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

# Resolve all paths from this file, so the command works from any directory.
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly APP_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
readonly REPO_ROOT="$(cd -- "$APP_ROOT/.." && pwd -P)"
readonly API_PROJECT="$APP_ROOT/SpaceOfThoughts.API/SpaceOfThoughts.API.csproj"
readonly UI_PROJECT_DIR="$APP_ROOT/SpaceOfThoughts.UI"
readonly UI_PACKAGE_LOCK="$UI_PROJECT_DIR/package-lock.json"
readonly ARTIFACTS_DIR="$REPO_ROOT/artifacts"

[[ ${BASH_VERSINFO[0]} -ge 4 ]] || die "Bash 4 or newer is required."

for command_name in dotnet npm node git tar gzip sha256sum mktemp find grep cp chmod install mv date dirname basename mkdir rm; do
    require_command "$command_name"
done

[[ -f "$API_PROJECT" ]] || die "API project not found: $API_PROJECT"
[[ -f "$UI_PROJECT_DIR/package.json" ]] || die "Angular package.json not found: $UI_PROJECT_DIR/package.json"
[[ -f "$UI_PACKAGE_LOCK" ]] || die "A package-lock.json is required for the reproducible npm ci build."
git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
    || die "Repository root is not a Git working tree: $REPO_ROOT"

# GNU tar provides the normalization options used below. Failing early avoids
# silently producing an archive whose metadata varies from build to build.
tar --help 2>/dev/null | grep -- '--sort' >/dev/null \
    || die "GNU tar is required (the installed tar does not support --sort)."

# The application version leads the release id, so a release names the version it
# carries: `spotctl releases` on the server then lines up with what the account
# page and the update prompt report.
UI_VERSION="$(node -e 'process.stdout.write(require(process.argv[1]).version)'     "$UI_PROJECT_DIR/package.json")"
readonly UI_VERSION
[[ "$UI_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]     || die "The Angular package.json version must look like 1.2.3, found: ${UI_VERSION:-<empty>}"

readonly GIT_COMMIT="$(git -C "$REPO_ROOT" rev-parse --verify HEAD)"
readonly SHORT_COMMIT="${GIT_COMMIT:0:12}"
[[ "$GIT_COMMIT" =~ ^[0-9a-fA-F]{40,64}$ ]] || die "Git returned an invalid commit identifier."

# A release should correspond to committed source. Include relevant untracked
# files in this decision; generated artifacts are excluded through .gitignore.
# ALLOW_DIRTY=1 exists only for deliberate local test packages.
readonly WORKTREE_STATUS="$(git -C "$REPO_ROOT" status --porcelain --untracked-files=normal)"
if [[ -n "$WORKTREE_STATUS" ]]; then
    readonly SOURCE_DIRTY="true"
    [[ "${ALLOW_DIRTY:-0}" == "1" ]] \
        || die "The Git worktree contains tracked, staged, or untracked changes. Commit them or use ALLOW_DIRTY=1 for a non-production test build."
else
    readonly SOURCE_DIRTY="false"
fi

# SOURCE_DATE_EPOCH lets CI recreate the same timestamps and archive metadata.
# Without it, the current UTC time becomes the release build time.
readonly BUILD_EPOCH="${SOURCE_DATE_EPOCH:-$(date -u +%s)}"
[[ "$BUILD_EPOCH" =~ ^[0-9]+$ ]] || die "SOURCE_DATE_EPOCH must be a non-negative integer."
readonly BUILD_TIME_UTC="$(date -u -d "@$BUILD_EPOCH" '+%Y-%m-%dT%H:%M:%SZ')" \
    || die "Unable to convert SOURCE_DATE_EPOCH with GNU date."
readonly BUILD_ID_TIME="$(date -u -d "@$BUILD_EPOCH" '+%Y%m%dT%H%M%SZ')" \
    || die "Unable to create the release timestamp with GNU date."
BASE_RELEASE_ID="${RELEASE_ID:-v${UI_VERSION}-${BUILD_ID_TIME}-${SHORT_COMMIT}}"
if [[ "$SOURCE_DIRTY" == "true" && "$BASE_RELEASE_ID" != *-dirty ]]; then
    BASE_RELEASE_ID="${BASE_RELEASE_ID}-dirty"
fi
readonly RELEASE_ID="$BASE_RELEASE_ID"
unset BASE_RELEASE_ID
[[ "$RELEASE_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] \
    || die "RELEASE_ID may contain only letters, digits, dots, underscores, and hyphens (maximum 128 characters)."

readonly ARCHIVE_NAME="spaceofthoughts-${RELEASE_ID}-${RID}.tar.gz"
readonly ARCHIVE_PATH="$ARTIFACTS_DIR/$ARCHIVE_NAME"
readonly CHECKSUM_PATH="$ARCHIVE_PATH.sha256"

# Two different builds must never claim the same version, or the update prompt
# announces a number the reader may already be running. The version is raised
# with deployment/bump-version.sh in the repository where editing happens.
# ALLOW_SAME_VERSION=1 exists for rebuilding a release that was never shipped.
if [[ -d "$ARTIFACTS_DIR" ]]; then
    existing_release="$(find "$ARTIFACTS_DIR" -maxdepth 1 -type f \
        -name "spaceofthoughts-v${UI_VERSION}-*.tar.gz" -print -quit)"
    if [[ -n "$existing_release" && "${ALLOW_SAME_VERSION:-0}" != "1" ]]; then
        die "Version $UI_VERSION was already built: $(basename -- "$existing_release"). Raise it with deployment/bump-version.sh, or set ALLOW_SAME_VERSION=1 to rebuild it."
    fi
    unset existing_release
fi

[[ ! -e "$ARCHIVE_PATH" ]] || die "Release archive already exists: $ARCHIVE_PATH"
[[ ! -e "$CHECKSUM_PATH" ]] || die "Release checksum already exists: $CHECKSUM_PATH"

TEMP_ROOT=""
PARTIAL_ARCHIVE=""
PARTIAL_CHECKSUM=""

cleanup() {
    local exit_code=$?

    # Every cleanup target is created by this invocation and is checked before
    # removal. This prevents an empty variable from becoming a broad target.
    if [[ -n "$TEMP_ROOT" && -d "$TEMP_ROOT" && "$TEMP_ROOT" != "/" ]]; then
        rm -rf -- "$TEMP_ROOT"
    fi
    if [[ -n "$PARTIAL_ARCHIVE" && -f "$PARTIAL_ARCHIVE" ]]; then
        rm -f -- "$PARTIAL_ARCHIVE"
    fi
    if [[ -n "$PARTIAL_CHECKSUM" && -f "$PARTIAL_CHECKSUM" ]]; then
        rm -f -- "$PARTIAL_CHECKSUM"
    fi

    exit "$exit_code"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/spaceofthoughts-release.XXXXXXXX")"
readonly RELEASE_ROOT="$TEMP_ROOT/release"
readonly API_OUTPUT="$RELEASE_ROOT/api"
readonly UI_BUILD_OUTPUT="$TEMP_ROOT/angular-output"
readonly UI_OUTPUT="$RELEASE_ROOT/$UI_ROOT_PATH"
readonly TEMP_ARCHIVE="$TEMP_ROOT/$ARCHIVE_NAME"
readonly TEMP_CHECKSUM="$TEMP_ROOT/$ARCHIVE_NAME.sha256"

mkdir -p -- "$API_OUTPUT" "$UI_BUILD_OUTPUT" "$UI_OUTPUT"

info "Installing locked Angular dependencies"
npm --prefix "$UI_PROJECT_DIR" ci --no-audit --no-fund

info "Building the Angular production application"
npm --prefix "$UI_PROJECT_DIR" run build -- \
    --configuration production \
    --output-path "$UI_BUILD_OUTPUT" \
    --source-map=false

# New Angular application builds place browser files below `browser`; older
# browser builders place them directly in output-path. Normalize both layouts
# so Nginx can always serve the release's `ui/browser` directory.
if [[ -f "$UI_BUILD_OUTPUT/browser/index.html" ]]; then
    cp -a -- "$UI_BUILD_OUTPUT/browser/." "$UI_OUTPUT/"
elif [[ -f "$UI_BUILD_OUTPUT/index.html" ]]; then
    cp -a -- "$UI_BUILD_OUTPUT/." "$UI_OUTPUT/"
else
    die "Angular build did not produce an index.html in the expected output directory."
fi
[[ -s "$UI_OUTPUT/index.html" ]] || die "Angular release index is missing or empty."

# The update prompt reports appData.version from the service-worker manifest, and
# the checked-in value is only a placeholder. Stamp the application version from
# package.json, which is the same value the account page displays. Editing the
# built manifest rather than the repository keeps the build clone clean, which is
# what keeps `-dirty` out of later release ids. appData carries no integrity
# guarantee of its own; the manifest hashes assets.
readonly UI_SERVICE_WORKER_MANIFEST="$UI_OUTPUT/ngsw.json"
if [[ -f "$UI_SERVICE_WORKER_MANIFEST" ]]; then
    info "Stamping version $UI_VERSION into the service worker manifest"
    node -e '
const fs = require("fs");
const [manifestPath, version] = process.argv.slice(1);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.appData = { ...manifest.appData, version };
fs.writeFileSync(manifestPath, JSON.stringify(manifest));
' "$UI_SERVICE_WORKER_MANIFEST" "$UI_VERSION"
else
    die "The Angular build produced no ngsw.json; the service worker is not configured."
fi

info "Publishing the self-contained API for $RID"
dotnet publish "$API_PROJECT" \
    --configuration Release \
    --runtime "$RID" \
    --self-contained true \
    --output "$API_OUTPUT" \
    --nologo \
    -p:PublishSingleFile=false \
    -p:PublishTrimmed=false \
    -p:PublishReadyToRun=false \
    -p:DebugSymbols=false \
    -p:DebugType=None \
    -p:Deterministic=true \
    -p:ContinuousIntegrationBuild=true

# Development settings and symbols do not belong in a production artifact.
# Production secrets are injected later through systemd's EnvironmentFile.
find "$API_OUTPUT" -maxdepth 1 -type f \
    \( -name 'appsettings.Development.json' -o -name '*.pdb' \) -delete

readonly API_EXECUTABLE="$RELEASE_ROOT/$API_EXECUTABLE_PATH"
[[ -s "$API_EXECUTABLE" ]] || die "Published API executable is missing or empty: $API_EXECUTABLE_PATH"
chmod 0755 -- "$API_EXECUTABLE"

# Refuse common source, source-map, environment, private-key, and certificate
# container files if a future project setting unexpectedly copies one.
forbidden_file="$(find "$RELEASE_ROOT" -type f \
    \( -name '*.cs' -o -name '*.csproj' -o -name '*.sln' -o -name '*.map' \
       -o -name '.env' -o -name '.env.*' -o -name 'secrets.json' \
       -o -name '*.pem' -o -name '*.key' -o -name '*.pfx' -o -name '*.p12' \) \
    -print -quit)"
[[ -z "$forbidden_file" ]] || die "Forbidden source or secret-like file entered the release: $forbidden_file"

symlink_path="$(find "$RELEASE_ROOT" -type l -print -quit)"
[[ -z "$symlink_path" ]] || die "Published release contains an unexpected symbolic link: $symlink_path"

# JSON is deliberately used instead of a shell-readable env file: deployment
# tooling must parse this as data and can never execute values from a release.
printf '{\n  "schemaVersion": 1,\n  "releaseId": "%s",\n  "rid": "%s",\n  "commit": "%s",\n  "sourceDirty": %s,\n  "builtAtUtc": "%s",\n  "apiExecutable": "%s",\n  "uiRoot": "%s"\n}\n' \
    "$RELEASE_ID" \
    "$RID" \
    "$GIT_COMMIT" \
    "$SOURCE_DIRTY" \
    "$BUILD_TIME_UTC" \
    "$API_EXECUTABLE_PATH" \
    "$UI_ROOT_PATH" \
    > "$RELEASE_ROOT/$MANIFEST_PATH"

# Normalize permissions before archiving. Only the API launcher needs execute
# permission; release contents will later be installed root-owned and read-only.
find "$RELEASE_ROOT" -type d -exec chmod 0755 {} +
find "$RELEASE_ROOT" -type f -exec chmod 0644 {} +
chmod 0755 -- "$API_EXECUTABLE"

info "Creating normalized release archive"
tar \
    --sort=name \
    --mtime="@$BUILD_EPOCH" \
    --owner=0 \
    --group=0 \
    --numeric-owner \
    --format=posix \
    --pax-option=delete=atime,delete=ctime \
    -C "$RELEASE_ROOT" \
    -cf - "$MANIFEST_PATH" api ui \
    | gzip -n -9 > "$TEMP_ARCHIVE"

[[ -s "$TEMP_ARCHIVE" ]] || die "Release archive was not created."
readonly ARCHIVE_SHA256="$(sha256sum "$TEMP_ARCHIVE" | grep -Eo '^[0-9a-fA-F]{64}')"
[[ "$ARCHIVE_SHA256" =~ ^[0-9a-fA-F]{64}$ ]] || die "Unable to calculate the archive SHA-256 checksum."
printf '%s  %s\n' "$ARCHIVE_SHA256" "$ARCHIVE_NAME" > "$TEMP_CHECKSUM"

mkdir -p -- "$ARTIFACTS_DIR"
PARTIAL_ARCHIVE="$ARTIFACTS_DIR/.${ARCHIVE_NAME}.partial.$$"
PARTIAL_CHECKSUM="$ARTIFACTS_DIR/.${ARCHIVE_NAME}.sha256.partial.$$"
install -m 0644 -- "$TEMP_ARCHIVE" "$PARTIAL_ARCHIVE"
install -m 0644 -- "$TEMP_CHECKSUM" "$PARTIAL_CHECKSUM"
mv -- "$PARTIAL_ARCHIVE" "$ARCHIVE_PATH"
PARTIAL_ARCHIVE=""
mv -- "$PARTIAL_CHECKSUM" "$CHECKSUM_PATH"
PARTIAL_CHECKSUM=""

info "Verifying the completed artifact checksum"
(
    cd -- "$ARTIFACTS_DIR"
    sha256sum --check "$(basename -- "$CHECKSUM_PATH")"
)

printf '\nRelease created successfully:\n  Archive:  %s\n  Checksum: %s\n  Release:  %s\n  Commit:   %s\n  RID:      %s\n' \
    "$ARCHIVE_PATH" \
    "$CHECKSUM_PATH" \
    "$RELEASE_ID" \
    "$GIT_COMMIT" \
    "$RID"
