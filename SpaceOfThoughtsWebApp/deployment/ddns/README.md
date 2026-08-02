# Cloudflare IPv6 DDNS

This host-level component keeps the existing `spaceofthoughts.com` Cloudflare
`AAAA` record aligned with the production server's stable global IPv6 address.
It is installed independently from versioned API/UI releases because its
configuration and credential belong to the host, not to the application.

The updater is deliberately fail-safe: it requires exactly one matching local
IPv6 address and exactly one existing Cloudflare `AAAA` record. It never creates
or deletes DNS records, and it does not make an API write when the address, TTL,
and proxy setting are already current.

Install the DDNS files directly into their permanent host locations:

```text
/etc/spaceofthoughts/
└── ddns.env

/etc/systemd/system/
├── spaceofthoughts-ddns.service
└── spaceofthoughts-ddns.timer

/usr/local/libexec/spaceofthoughts/
└── cloudflare-ipv6-ddns.sh
```

Run the installation commands below from the `SpaceOfThoughtsWebApp`
directory so the repository's `deployment` paths resolve correctly.

## Prerequisites

The production host needs systemd, Bash 4 or newer, `curl`, `jq`, the
`iproute2` tools, and `dig` for verification. On Debian or Ubuntu, install the
command dependencies with:

```bash
sudo apt update
sudo apt install -y curl dnsutils iproute2 jq
```

Create a dedicated Cloudflare API token with `Zone` / `DNS` / `Edit` permission
for only the `spaceofthoughts.com` zone. Do not reuse the Certbot token: DDNS
updates the apex `AAAA` record, while Certbot temporarily manages independent
`_acme-challenge` `TXT` records.

Create the apex `AAAA` record in Cloudflare before enabling DDNS. The updater
will refuse to guess or create it when it is absent.

## Configure the production host

On the production host, inspect the server's interface and primary global IPv6
addresses:

```bash
ip -br link
ip -6 -o addr show dev eth0 scope global primary \
  -deprecated -tentative -dadfailed
```

Choose a stable host suffix long enough to match exactly one address. A single
four-digit group is usually too short. If the host portion itself changes when
the delegated prefix changes, configure a stable IPv6 address on the server
before relying on suffix matching.

Install a separate, root-only configuration file:

```bash
sudo install -d -o root -g root -m 0700 /etc/spaceofthoughts
sudo install -o root -g root -m 0600 \
  deployment/ddns/ddns.env.example /etc/spaceofthoughts/ddns.env
sudoedit /etc/spaceofthoughts/ddns.env
```

Replace every `REPLACE_WITH_...` value. Keep `/etc/spaceofthoughts/ddns.env`
separate from `/etc/spaceofthoughts/api.env`; the web application must never
receive DNS control credentials. Confirm its ownership and mode without
printing the token:

```bash
sudo stat -c '%A %U:%G %n' /etc/spaceofthoughts/ddns.env
sudo sed -E 's/=.*/=<redacted>/' /etc/spaceofthoughts/ddns.env
```

The apex is intentionally DNS-only, so keep `CF_PROXIED=false` and the desired
TTL. If this deployment later enables the Cloudflare proxy, set
`CF_PROXIED=true` and `CF_TTL=1`; Cloudflare requires Automatic TTL for proxied
records.

## Install and enable the updater

Install the reviewed script and systemd units:

```bash
sudo install -d -o root -g root -m 0755 \
  /usr/local/libexec/spaceofthoughts
sudo install -o root -g root -m 0755 \
  deployment/ddns/cloudflare-ipv6-ddns.sh \
  /usr/local/libexec/spaceofthoughts/cloudflare-ipv6-ddns.sh
sudo install -o root -g root -m 0644 \
  deployment/systemd/spaceofthoughts-ddns.service \
  deployment/systemd/spaceofthoughts-ddns.timer \
  /etc/systemd/system/
sudo systemctl daemon-reload
```

Run one update interactively before enabling the schedule:

```bash
sudo systemctl start spaceofthoughts-ddns.service
sudo systemctl status spaceofthoughts-ddns.service
sudo journalctl -u spaceofthoughts-ddns.service -n 50 --no-pager
```

A successful oneshot is shown as `inactive (dead)` after it exits; its status
must also show `status=0/SUCCESS` and the journal must contain no error.

Only after that one-shot run succeeds, enable the timer:

```bash
sudo systemctl enable --now spaceofthoughts-ddns.timer
systemctl list-timers spaceofthoughts-ddns.timer
```

The first scheduled run occurs about one minute after boot. Later runs start
five minutes after the preceding run finishes, plus a 30-second randomized
delay and systemd's 15-second accuracy window. Executions cannot overlap, and a
failed oneshot is still treated as deactivated and remains eligible for retry.

## Verify and maintain

Check the result through the host's recursive DNS resolver and inspect recent
runs. The resolver may retain the previous address until its TTL expires:

```bash
dig AAAA spaceofthoughts.com
sudo journalctl -u spaceofthoughts-ddns.service --since today --no-pager
```

The script and units are host bootstrap files, not part of the release archive.
After changing them in the repository, reinstall the reviewed files directly
into the permanent paths with the commands above and run
`sudo systemctl daemon-reload` when a unit changed.

To rotate the DDNS token, create a replacement with the same narrow scope,
update only `/etc/spaceofthoughts/ddns.env`, manually run the service, and revoke
the old token after the run succeeds.
