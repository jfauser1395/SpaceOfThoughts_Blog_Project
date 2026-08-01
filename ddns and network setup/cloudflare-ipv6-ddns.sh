#!/usr/bin/env bash
## This updater intentionally requires Bash; it is not compatible with bin/sh.

#######################################################
## REQUIRED SETUP BEFORE ENABLING THE CRON JOB
#######################################################
# [REQUIRED SECRET]
# CF_API_TOKEN
#   - Store outside this file.
#   - Inject it as an environment variable.
#   - Required permission: Cloudflare Zone / DNS / Edit.
#
# [VERIFY AFTER MOVING TO ANOTHER SERVER]
# CF_ZONE_ID
#   - Must identify the Cloudflare zone containing the hostname.
#
# CF_RECORD_NAME
#   - Must be the exact existing AAAA record.
#
# IPV6_INTERFACE
#   - Confirm with: ip -br link
#
# IPV6_SUFFIX
#   - Confirm with:
#     ip -6 -o addr show scope global primary
#
# [IMPORTANT]
# Never commit CF_API_TOKEN to this script.
#######################################################

# Exit on command failures, unset variables, and failed pipeline components.
# Restrict permissions on any files created by this process.
set -Eeuo pipefail
umask 077

##############  CLOUDFLARE CREDENTIALS  ##############
# @CF_API_TOKEN        - Scoped Cloudflare API token with Zone / DNS / Edit
#                        permission for this zone. Inject it as an environment
#                        secret; never paste the real token into this file.
# @CF_ZONE_ID          - The 32-character Zone ID shown on the Cloudflare
#                        domain Overview page. This identifier is not secret.
# -------------------------------------------------- #
: "${CF_ZONE_ID:=073e4b02b8322dca71ec127add56d9db}"

#############  DNS RECORD CONFIGURATION  #############
# @CF_RECORD_NAME      - Fully qualified name of the one existing AAAA record
#                        that should follow this server's IPv6 address.
# @CF_TTL              - DNS cache lifetime in seconds. A value of 300 gives a
#                        practical five-minute recovery window after a change.
#                        Cloudflare also accepts 1 for Automatic, or 60-86400.
# @CF_PROXIED          - false publishes the server's IPv6 address directly.
#                        Set true only when Cloudflare should proxy the website.
# -------------------------------------------------- #
: "${CF_RECORD_NAME:=spaceofthoughts.com}"
: "${CF_TTL:=300}"
: "${CF_PROXIED:=false}"

###############  IPV6 HOST CONFIGURATION  ############
# @IPV6_SUFFIX         - Stable host portion of the web server's global IPv6
#                        address. For example, 44c9 matches an address ending
#                        in :44c9. Use a longer suffix if it is not unique.
# @IPV6_INTERFACE      - Ethernet interface used by the web server. This
#                        Raspberry Pi uses eth0, so only that interface is
#                        searched for the stable global IPv6 address.
# -------------------------------------------------- #
: "${IPV6_SUFFIX:=44c9}"
: "${IPV6_INTERFACE:=eth0}"

###############  INTERNAL CONSTANTS  #################
# These values define the log name and Cloudflare API endpoint. They normally
# do not need to be changed when moving the script to another Linux server.
# -------------------------------------------------- #
readonly PROGRAM_NAME="cloudflare-ipv6-ddns"
readonly API_ROOT="https://api.cloudflare.com/client/v4"


################################################
## Logging and error handling
################################################
# Prefer the system log for cron operation. The stderr fallback keeps messages
# visible on minimal installations where the logger command is unavailable.
log() {
    if command -v logger >/dev/null 2>&1; then
        logger -t "$PROGRAM_NAME" -- "$*"
    else
        printf '%s: %s\n' "$PROGRAM_NAME" "$*" >&2
    fi
}

die() {
    trap - ERR
    log "ERROR: $*"
    exit 1
}

unexpected_error() {
    local exit_code=$?
    trap - ERR
    log "ERROR: unexpected failure on line $1"
    exit "$exit_code"
}

trap 'unexpected_error "$LINENO"' ERR


################################################
## Dependency and configuration validation
################################################
# Fail before making a network request when a required Linux tool is missing.
for dependency in curl ip jq; do
    command -v "$dependency" >/dev/null 2>&1 ||
        die "required command is missing: $dependency"
done

# CF_API_TOKEN intentionally has no default because it must come from the
# destination's secret manager or protected runtime environment.
for setting in CF_API_TOKEN CF_ZONE_ID CF_RECORD_NAME IPV6_SUFFIX; do
    [[ -n "${!setting:-}" ]] || die "required setting is empty: $setting"
done

# Reject malformed values rather than sending an unsafe or ambiguous request.
[[ "$CF_API_TOKEN" =~ ^[A-Za-z0-9._-]+$ ]] ||
    die "CF_API_TOKEN contains unexpected characters"
[[ "$CF_ZONE_ID" =~ ^[A-Fa-f0-9]{32}$ ]] ||
    die "CF_ZONE_ID must be a 32-character identifier"
[[ "$CF_RECORD_NAME" == *.* &&
   "$CF_RECORD_NAME" != *[!A-Za-z0-9._-]* ]] ||
    die "CF_RECORD_NAME is not a valid fully qualified DNS name"
[[ "$IPV6_SUFFIX" =~ ^[A-Fa-f0-9:]{1,39}$ ]] ||
    die "IPV6_SUFFIX must contain only hexadecimal digits and colons"
[[ "$CF_TTL" =~ ^[0-9]+$ ]] ||
    die "CF_TTL must be an integer"
(( ${#CF_TTL} <= 5 )) ||
    die "CF_TTL is outside Cloudflare's supported range"
CF_TTL=$((10#$CF_TTL))
(( CF_TTL == 1 || (CF_TTL >= 60 && CF_TTL <= 86400) )) ||
    die "CF_TTL must be 1 or between 60 and 86400"
[[ "$CF_PROXIED" == "true" || "$CF_PROXIED" == "false" ]] ||
    die "CF_PROXIED must be true or false"

if [[ -n "$IPV6_INTERFACE" ]]; then
    ip link show dev "$IPV6_INTERFACE" >/dev/null 2>&1 ||
        die "IPv6 interface does not exist: $IPV6_INTERFACE"
fi


################################################
## Find the stable global IPv6 address
################################################
# Normalize the suffix so hexadecimal letter case and surrounding colons do
# not affect the comparison.
suffix="${IPV6_SUFFIX,,}"
suffix="${suffix#:}"
suffix="${suffix%:}"
[[ -n "$suffix" ]] || die "IPV6_SUFFIX cannot contain only colons"

# Ask Linux for primary global addresses only. Temporary privacy addresses and
# addresses that are deprecated, tentative, or failed duplicate detection are
# excluded because they must never be published as the web server endpoint.
ip_command=(ip -6 -o addr show)
[[ -n "$IPV6_INTERFACE" ]] && ip_command+=(dev "$IPV6_INTERFACE")
ip_command+=(scope global primary -deprecated -tentative -dadfailed)

address_output=$("${ip_command[@]}") ||
    die "unable to inspect global IPv6 addresses"

# Remove CIDR prefix lengths and retain only addresses ending in the configured
# stable host suffix. Linux already supplies canonical IPv6 notation here.
matching_addresses=()
while IFS= read -r address_line; do
    [[ -n "$address_line" ]] || continue
    read -r _ _ _ address _ <<<"$address_line"
    address="${address%/*}"
    address="${address,,}"

    if [[ "$address" == "$suffix" || "$address" == *":$suffix" ]]; then
        matching_addresses+=("$address")
    fi
done <<<"$address_output"

# Refuse to guess when the suffix identifies no address or multiple addresses.
# Publishing the wrong address could make the website unreachable or expose a
# different device.
if (( ${#matching_addresses[@]} == 0 )); then
    die "no stable global IPv6 address matches IPV6_SUFFIX"
fi
if (( ${#matching_addresses[@]} > 1 )); then
    die "multiple global IPv6 addresses match IPV6_SUFFIX; make it more specific"
fi
current_ip="${matching_addresses[0]}"


################################################
## Cloudflare API client configuration
################################################
# Short timeouts and bounded retries prevent a scheduled run from hanging
# indefinitely during a network or Cloudflare service problem.
curl_common=(
    --silent
    --show-error
    --fail
    --connect-timeout 10
    --max-time 30
    --retry 2
    --retry-delay 1
    --header "Accept: application/json"
    --header "Content-Type: application/json"
    --user-agent "$PROGRAM_NAME/1.0"
)

# Pass the token through curl's configuration input. This keeps the secret out
# of curl's process command line and prevents it from being written to logs.
cloudflare_curl() {
    printf 'header = "Authorization: Bearer %s"\n' "$CF_API_TOKEN" |
        curl "${curl_common[@]}" --config - "$@"
}


################################################
## Locate the existing AAAA record
################################################
# Query by exact record type and hostname. A response limit of two is enough to
# detect an unsafe duplicate without retrieving unnecessary zone data.
record_json=$(
    cloudflare_curl \
        --get \
        --data-urlencode "type=AAAA" \
        --data-urlencode "name=$CF_RECORD_NAME" \
        --data-urlencode "per_page=2" \
        "$API_ROOT/zones/$CF_ZONE_ID/dns_records"
) || die "Cloudflare record lookup failed"

# Parse JSON structurally instead of using regular expressions. The updater
# only proceeds when Cloudflare reports success and returns exactly one record.
jq -e '.success == true and (.result | type == "array")' \
    >/dev/null <<<"$record_json" ||
    die "Cloudflare rejected the record lookup"

record_count=$(jq -r '.result | length' <<<"$record_json")
(( record_count == 1 )) ||
    die "expected exactly one AAAA record named $CF_RECORD_NAME; found $record_count"

record_id=$(jq -er '.result[0].id' <<<"$record_json") ||
    die "Cloudflare response did not include a record identifier"
old_ip=$(jq -er '.result[0].content' <<<"$record_json") ||
    die "Cloudflare response did not include the current AAAA address"

[[ "$record_id" =~ ^[A-Fa-f0-9]{32}$ ]] ||
    die "Cloudflare returned an invalid record identifier"
[[ "$old_ip" == *:* ]] ||
    die "Cloudflare returned invalid AAAA record content"


################################################
## Compare the local and published IPv6 addresses
################################################
# Cloudflare and Linux both return canonical IPv6 notation, allowing a direct
# comparison and avoiding unnecessary API writes when nothing changed.
if [[ "$current_ip" == "$old_ip" ]]; then
    log "AAAA record is already current: $CF_RECORD_NAME"
    exit 0
fi


################################################
## Update the Cloudflare AAAA record
################################################
# Build typed JSON with jq so the address and record name are encoded safely,
# while TTL remains numeric and proxied remains boolean.
update_payload=$(
    jq -cn \
        --arg type "AAAA" \
        --arg name "$CF_RECORD_NAME" \
        --arg content "$current_ip" \
        --argjson ttl "$CF_TTL" \
        --argjson proxied "$CF_PROXIED" \
        '{type: $type, name: $name, content: $content, ttl: $ttl, proxied: $proxied}'
) || die "unable to build the Cloudflare update request"

# PATCH changes only the selected AAAA record. Other records in the zone are
# never created, modified, or deleted by this updater.
update_json=$(
    cloudflare_curl \
        --request PATCH \
        --data "$update_payload" \
        "$API_ROOT/zones/$CF_ZONE_ID/dns_records/$record_id"
) || die "Cloudflare record update failed"


################################################
## Verify and report the update
################################################
# Do not report success merely because curl returned data. Require Cloudflare's
# success flag and confirm that it stored the requested IPv6 address.
jq -e '.success == true' >/dev/null <<<"$update_json" ||
    die "Cloudflare rejected the record update"
updated_ip=$(jq -er '.result.content' <<<"$update_json") ||
    die "Cloudflare update response did not include the AAAA address"
[[ "$updated_ip" == "$current_ip" ]] ||
    die "Cloudflare update response did not match the requested IPv6 address"

log "updated AAAA record: $CF_RECORD_NAME"
