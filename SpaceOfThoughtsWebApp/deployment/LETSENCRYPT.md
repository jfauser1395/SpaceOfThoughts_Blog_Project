# Let's Encrypt with Cloudflare DNS and Certbot

This runbook installs and renews one certificate for `spaceofthoughts.com` and
`www.spaceofthoughts.com` on the Debian/Ubuntu ARM64 production host. Validation
uses Cloudflare DNS-01, so it is independent of the server's changing IPv6
address, inbound ports, and Cloudflare proxy status.

The DDNS updater changes only the apex `AAAA` record. Certbot temporarily
creates `_acme-challenge` `TXT` records, so the two processes do not conflict.
Never commit or paste either Cloudflare API token into source, logs, or chat.

## 1. Create the Cloudflare token

In Cloudflare, create a dedicated API token with:

- Permission: `Zone` / `DNS` / `Edit`
- Resource: only the `spaceofthoughts.com` zone

Keep this token separate from the DDNS token so either credential can be
rotated or revoked independently.

## 2. Install Certbot and the Cloudflare plugin

Check for an existing installation first; do not mix an OS-package Certbot with
the Snap installation:

```bash
command -v certbot
certbot --version 2>/dev/null || true
```

For a new installation:

```bash
sudo apt update
sudo apt install -y snapd
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
```

Create the command link only when it does not already exist:

```bash
if [[ ! -e /usr/local/bin/certbot ]]; then
    sudo ln -s /snap/bin/certbot /usr/local/bin/certbot
fi
```

Install the Cloudflare DNS plugin:

```bash
sudo snap set certbot trust-plugin-with-root=ok
sudo snap install certbot-dns-cloudflare
```

## 3. Store the Cloudflare credential

```bash
sudo install -d -m 700 /root/.secrets/certbot
sudoedit /root/.secrets/certbot/cloudflare.ini
```

Enter this line with the real token, then save the file:

```ini
dns_cloudflare_api_token = REPLACE_WITH_CERTBOT_TOKEN
```

Protect it:

```bash
sudo chown root:root /root/.secrets/certbot/cloudflare.ini
sudo chmod 600 /root/.secrets/certbot/cloudflare.ini
```

## 4. Issue the certificate

The explicit certificate name produces the paths already referenced by the
Nginx configuration.

```bash
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/certbot/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 60 \
  --cert-name spaceofthoughts.com \
  -d spaceofthoughts.com \
  -d www.spaceofthoughts.com
```

Certbot creates:

```text
/etc/letsencrypt/live/spaceofthoughts.com/fullchain.pem
/etc/letsencrypt/live/spaceofthoughts.com/privkey.pem
```

Verify the certificate and its two DNS names:

```bash
sudo certbot certificates
sudo openssl x509 \
  -in /etc/letsencrypt/live/spaceofthoughts.com/fullchain.pem \
  -noout -issuer -dates -ext subjectAltName
```

## 5. Validate and start Nginx

Deploy the repository's Nginx configuration, then run:

```bash
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

Do not continue after a failed `nginx -t`. Unknown `brotli`, `quic`, or `http3`
directives indicate that the installed Nginx build lacks a required module.

For proxied `www` traffic, set Cloudflare **SSL/TLS / Overview** to **Full
(strict)** after HTTPS works at the origin. Never use Flexible mode.

## 6. Reload Nginx after renewal

```bash
sudo install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
sudoedit /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
```

Save this hook. It suppresses the successful `nginx -t` message that Nginx
writes to stderr, while preserving actual validation errors:

```sh
#!/bin/sh

if ! output=$(/usr/sbin/nginx -t 2>&1); then
    printf '%s\n' "$output" >&2
    exit 1
fi

exec /usr/bin/systemctl reload nginx
```

Protect and test it:

```bash
sudo chown root:root /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
sudo /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
sudo systemctl is-active nginx
```

## 7. Verify automatic renewal

The Certbot Snap installs its renewal timer automatically:

```bash
systemctl list-timers --all | grep -i certbot
sudo systemctl status snap.certbot.renew.timer
```

If the timer exists but is disabled:

```bash
sudo systemctl enable --now snap.certbot.renew.timer
```

Test DNS validation, simulated renewal, and the deploy hook together:

```bash
sudo certbot renew --dry-run --run-deploy-hooks
```

The 60-second DNS wait occurs only during a real or simulated renewal, not each
time the timer checks a certificate that is not due. Keeping 60 seconds is the
conservative setting. To change future renewals to Cloudflare's 10-second
default, use Certbot rather than editing its managed renewal file:

```bash
sudo certbot reconfigure \
  --cert-name spaceofthoughts.com \
  --dns-cloudflare-propagation-seconds 10
```

Inspect the saved renewal method without revealing the token:

```bash
sudo grep -E '^(authenticator|dns_cloudflare_credentials|dns_cloudflare_propagation_seconds)' \
  /etc/letsencrypt/renewal/spaceofthoughts.com.conf
```

## 8. Final checks

```bash
curl -6I https://spaceofthoughts.com
curl -I https://www.spaceofthoughts.com
sudo certbot certificates
sudo systemctl is-active nginx
```

The apex connects directly to Nginx and presents the Let's Encrypt certificate.
Proxied `www` visitors see Cloudflare's edge certificate; Cloudflare validates
the Let's Encrypt origin certificate in Full (strict) mode.

Official references:

- [Certbot installation and renewal](https://certbot.eff.org/instructions?os=snap&tab=standard&ws=nginx)
- [Certbot Cloudflare DNS plugin](https://certbot-dns-cloudflare.readthedocs.io/en/stable/)
- [Cloudflare Full (strict) mode](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/)
