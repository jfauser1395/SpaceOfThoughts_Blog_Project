#!/usr/bin/env bash

# Raise the application version and commit it, in the repository where editing
# happens. The version is source like any other file, so it travels to the build
# clone the same way everything else does: through a commit and a pull.
#
# Two things about running under Git Bash on Windows shape this script:
#   - `pwd -P` yields a POSIX path such as /c/Users/..., which the Windows builds
#     of node and git cannot always resolve. Everything therefore runs with the
#     working directory changed, against relative paths.
#   - `npm version --dry-run` still rewrites package.json here, so it must never
#     be used to preview a number. The preview is computed arithmetically and npm
#     is called only once, with the exact version to write.

set -Eeuo pipefail
umask 022

die() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

require_command npm
require_command git
require_command node

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly APP_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
readonly REPO_ROOT="$(cd -- "$APP_ROOT/.." && pwd -P)"
readonly UI_PROJECT_DIR="$APP_ROOT/SpaceOfThoughts.UI"
readonly UI_RELATIVE_DIR="SpaceOfThoughtsWebApp/SpaceOfThoughts.UI"

[[ -f "$UI_PROJECT_DIR/package.json" ]] || die "Angular package.json not found: $UI_PROJECT_DIR/package.json"

# Every git command below runs from here, rather than through `git -C <path>`,
# which fails on a POSIX path containing an apostrophe.
cd -- "$REPO_ROOT" || die "Unable to enter the repository: $REPO_ROOT"

read_version() {
    (cd -- "$UI_PROJECT_DIR" \
        && node -e "process.stdout.write(require('./package.json').version)")
}

readonly CURRENT_VERSION="$(read_version)"
[[ "$CURRENT_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] \
    || die "The current version does not look like 1.2.3: ${CURRENT_VERSION:-<empty>}"

IFS='.' read -r CURRENT_MAJOR CURRENT_MINOR CURRENT_PATCH <<<"$CURRENT_VERSION"
readonly CURRENT_MAJOR CURRENT_MINOR CURRENT_PATCH

# Purely arithmetic, so showing the options cannot alter anything.
next_version() {
    case "$1" in
        patch) printf '%s.%s.%s' "$CURRENT_MAJOR" "$CURRENT_MINOR" "$((CURRENT_PATCH + 1))" ;;
        minor) printf '%s.%s.0' "$CURRENT_MAJOR" "$((CURRENT_MINOR + 1))" ;;
        major) printf '%s.0.0' "$((CURRENT_MAJOR + 1))" ;;
        *) die "Unknown release kind: $1" ;;
    esac
}

# Refuse to fold unrelated edits into the version commit.
readonly VERSION_FILES_STATUS="$(git status --porcelain -- \
    "$UI_RELATIVE_DIR/package.json" "$UI_RELATIVE_DIR/package-lock.json")"
[[ -z "$VERSION_FILES_STATUS" ]] \
    || die "package.json or package-lock.json already has uncommitted changes. Commit or discard them first."

printf 'Current version: %s\n\n' "$CURRENT_VERSION"
printf 'What kind of change is being released?\n'
printf '  1) small change      %s -> %s\n' "$CURRENT_VERSION" "$(next_version patch)"
printf '  2) bigger change     %s -> %s\n' "$CURRENT_VERSION" "$(next_version minor)"
printf '  3) complete rework   %s -> %s\n' "$CURRENT_VERSION" "$(next_version major)"
printf '  q) cancel\n\n'

read -r -p 'Choice: ' choice
# Input piped in from a Windows shell arrives with a carriage return attached.
choice="${choice%$'\r'}"
case "$choice" in
    1) NEW_VERSION="$(next_version patch)" ;;
    2) NEW_VERSION="$(next_version minor)" ;;
    3) NEW_VERSION="$(next_version major)" ;;
    q | Q) printf 'Cancelled. The version is unchanged.\n'; exit 0 ;;
    *) die "Choose 1, 2, 3, or q." ;;
esac
readonly NEW_VERSION

# npm writes the number into package.json and package-lock.json together; the
# version appears in the lock file too, and the two must never disagree.
(cd -- "$UI_PROJECT_DIR" \
    && npm --silent version "$NEW_VERSION" --no-git-tag-version >/dev/null) \
    || die "npm could not set the version to $NEW_VERSION."

readonly WRITTEN_VERSION="$(read_version)"
[[ "$WRITTEN_VERSION" == "$NEW_VERSION" ]] \
    || die "Expected package.json to read $NEW_VERSION, found ${WRITTEN_VERSION:-<empty>}."

git add -- \
    "$UI_RELATIVE_DIR/package.json" \
    "$UI_RELATIVE_DIR/package-lock.json"
git commit -m "chore: release $NEW_VERSION" >/dev/null

printf '\nVersion raised to %s and committed.\n' "$NEW_VERSION"
printf 'The account page and the update prompt will both report it once released.\n\n'
printf 'Next, on the build host:\n'
printf '  git -C ~/spaceofthoughts pull\n'
printf '  ~/spaceofthoughts/SpaceOfThoughtsWebApp/deployment/build-release.sh\n'
printf '  ~/spaceofthoughts/SpaceOfThoughtsWebApp/deployment/ship-release.sh\n'
