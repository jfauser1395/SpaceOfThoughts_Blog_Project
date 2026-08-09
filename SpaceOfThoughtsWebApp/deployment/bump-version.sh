#!/usr/bin/env bash

# Raise the application version and commit it, in the repository where editing
# happens. The version is source like any other file, so it travels to the build
# clone the same way everything else does: through a commit and a pull.
#
# Run this before committing is finished, while the size of the change is still
# fresh. `npm version` is used rather than hand-editing JSON, because the version
# appears in package-lock.json as well and the two must not disagree.

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
# Git pathspecs are given relative to the repository, which keeps them valid
# whether this runs in Git Bash on Windows or in a Linux shell.
readonly UI_RELATIVE_DIR="SpaceOfThoughtsWebApp/SpaceOfThoughts.UI"

[[ -f "$UI_PROJECT_DIR/package.json" ]] || die "Angular package.json not found: $UI_PROJECT_DIR/package.json"

read_version() {
    node -e 'process.stdout.write(require(process.argv[1]).version)' \
        "$UI_PROJECT_DIR/package.json"
}

readonly CURRENT_VERSION="$(read_version)"
[[ "$CURRENT_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] \
    || die "The current version does not look like 1.2.3: ${CURRENT_VERSION:-<empty>}"

# Refuse to fold unrelated edits into the version commit.
readonly VERSION_FILES_STATUS="$(git -C "$REPO_ROOT" status --porcelain -- \
    "$UI_PROJECT_DIR/package.json" "$UI_PROJECT_DIR/package-lock.json")"
[[ -z "$VERSION_FILES_STATUS" ]] \
    || die "package.json or package-lock.json already has uncommitted changes. Commit or discard them first."

# Preview each option with the number it would produce, so the choice is about
# the change rather than about remembering what semantic versioning calls things.
preview() {
    npm --prefix "$UI_PROJECT_DIR" --silent version "$1" \
        --no-git-tag-version --dry-run 2>/dev/null || printf '?'
}

printf 'Current version: %s\n\n' "$CURRENT_VERSION"
printf 'What kind of change is being released?\n'
printf '  1) small change      %s -> %s\n' "$CURRENT_VERSION" "$(preview patch)"
printf '  2) bigger change     %s -> %s\n' "$CURRENT_VERSION" "$(preview minor)"
printf '  3) complete rework   %s -> %s\n' "$CURRENT_VERSION" "$(preview major)"
printf '  q) cancel\n\n'

read -r -p 'Choice: ' choice
case "$choice" in
    1) readonly BUMP="patch" ;;
    2) readonly BUMP="minor" ;;
    3) readonly BUMP="major" ;;
    q | Q) printf 'Cancelled. The version is unchanged.\n'; exit 0 ;;
    *) die "Choose 1, 2, 3, or q." ;;
esac

(cd -- "$UI_PROJECT_DIR" && npm --silent version "$BUMP" --no-git-tag-version >/dev/null)
readonly NEW_VERSION="$(read_version)"
[[ "$NEW_VERSION" != "$CURRENT_VERSION" ]] || die "npm did not change the version."

git -C "$REPO_ROOT" add -- \
    "$UI_PROJECT_DIR/package.json" \
    "$UI_PROJECT_DIR/package-lock.json"
git -C "$REPO_ROOT" commit -m "chore: release $NEW_VERSION" >/dev/null

printf '\nVersion raised to %s and committed.\n' "$NEW_VERSION"
printf 'The account page and the update prompt will both report it once released.\n\n'
printf 'Next, on the build host:\n'
printf '  git -C ~/spaceofthoughts pull\n'
printf '  ~/spaceofthoughts/SpaceOfThoughtsWebApp/deployment/build-release.sh\n'
printf '  ~/spaceofthoughts/SpaceOfThoughtsWebApp/deployment/ship-release.sh\n'
