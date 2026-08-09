# SpaceOfThoughts

SpaceOfThoughts is a full-stack blog application built with:

- ASP.NET Core 10 Web API
- Angular 22
- Entity Framework Core 10
- PostgreSQL
- ASP.NET Core Identity and JWT authentication

## Project structure

```text
SpaceOfThoughtsWebApp/
├── SpaceOfThoughts.API/   # ASP.NET Core API
├── SpaceOfThoughts.UI/    # Angular frontend
└── deployment/            # Deployment and Nginx configuration
```

## Prerequisites

Install the following tools:

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js](https://nodejs.org/) and npm
- [PostgreSQL](https://www.postgresql.org/download/)

The Angular CLI does not need to be installed globally; the project uses the
version recorded in `package-lock.json`.

Production installation additionally expects a systemd-based Linux host, Bash
4 or newer, OpenSSL, and a local PostgreSQL service.

## Uploaded image processing

Every new public-library, private-library, and profile image is processed by
the API before it is published. The processor accepts JPEG, PNG, WebP, and
AVIF raster input, verifies the decoded format rather than trusting the file
extension, rejects corrupt or animated input, auto-orients it, converts it to
sRGB, removes EXIF/IPTC/XMP metadata, and never upscales it. New SVG uploads are
rejected; existing SVG files and existing raster URLs are left untouched.

General images are limited to 10 MiB, 40 megapixels, and a 3840-pixel longest
edge. Profile pictures are limited to 5 MiB and a 1024-pixel longest edge. The
ImageMagick process also has strict memory, disk, dimension, frame, thread, and
time limits, and upload encodes are serialized for the Raspberry Pi host.

The canonical served output is WebP. PNG artwork and images with transparency
use lossless WebP. Opaque photographs use quality 94 (profile pictures use 95),
the highest WebP search method, sharp YUV conversion, automatic filtering, and
lossless alpha. This is intended to be visually indistinguishable for normal
web display; mathematically lossless photographs and maximum compression are
mutually exclusive goals. The profile editor sends its crop to the API as PNG
so that WebP encoding is the only lossy generation.

AVIF input is supported, but AVIF is not yet emitted as an unused second copy.
Serving AVIF efficiently requires first-class responsive variant metadata and
`picture`/`srcset` or negotiated background delivery, plus an encode benchmark
on the production Linux ARM64 host. Until that delivery contract exists, WebP
is the compatible fallback that every stored one-URL reference can consume.
Public images retain the one-hour cache policy because administrator-selected
filenames can be deleted and reused; immutable caching requires content-addressed
asset URLs as part of the later variant model.

## Local development configuration

The API reads configuration through the standard ASP.NET Core configuration
system. Required configuration keys include:

- `ConnectionStrings:SpaceOfThoughtsConnectionString`
- `Jwt:Key`
- `Jwt:Issuer`
- `Jwt:Audience`
- `BootstrapAdmin:UserName`
- `BootstrapAdmin:Email`

Do not put passwords, signing keys, API keys, or other credentials in this
README or in tracked configuration files.

For local development, store sensitive values with .NET User Secrets:

```bash
cd SpaceOfThoughtsWebApp/SpaceOfThoughts.API
dotnet user-secrets set 'ConnectionStrings:SpaceOfThoughtsConnectionString' \
  'Host=127.0.0.1;Port=5432;Database=spotdb;Username=<local-user>;Password=<local-password>'
dotnet user-secrets set 'Jwt:Key' "$(openssl rand -base64 48)"
dotnet user-secrets set 'BootstrapAdmin:UserName' '<username>'
dotnet user-secrets set 'BootstrapAdmin:Email' '<email>'
```

Configure the local database connection, a random JWT key, and the bootstrap
administrator identity with .NET User Secrets. The administrator password is
not a configuration value and must not be stored there.

The development issuer and audience in `appsettings.json` are:

```text
Jwt:Issuer   = https://localhost:7000
Jwt:Audience = https://localhost:7000
```

.NET User Secrets are intended only for local development. Use environment
variables or a managed secret store in production. Nested configuration keys
use double underscores in environment variables, for example `Jwt__Key`.

For a new local database, provision the administrator once through the API's
one-shot command. The password travels over standard input and is then stored
only as an ASP.NET Identity hash:

```bash
cd SpaceOfThoughtsWebApp/SpaceOfThoughts.API
read -r -s -p "Initial administrator password: " ADMIN_PASSWORD
printf '\n'
printf '%s\n' "$ADMIN_PASSWORD" | ASPNETCORE_ENVIRONMENT=Development \
  dotnet run --no-launch-profile -- \
  --spotctl-provision-admin --username '<username>' --email '<email>'
unset ADMIN_PASSWORD
```

The username and email must match the corresponding User Secrets values used
by normal API startup.

## Database setup

The project uses the Npgsql Entity Framework Core provider for PostgreSQL. The
reviewed initial migrations for `ApplicationDbContext` and `AuthDbContext` are
tracked in Git. Do not regenerate a new initial migration on each server.

The provisioning command and every normal API startup call `MigrateAsync()` for
both contexts. EF reads `__EFMigrationsHistory` and applies only tracked
migrations that are still pending. A manual development update remains
available when needed:

```bash
cd SpaceOfThoughtsWebApp/SpaceOfThoughts.API
dotnet ef database update --context ApplicationDbContext
dotnet ef database update --context AuthDbContext
```

When a model changes during development, append and commit a descriptive
migration for the affected context:

```bash
dotnet ef migrations add '<ChangeName>' --context ApplicationDbContext --output-dir Migrations/ApplicationDb
# or, for Identity changes:
dotnet ef migrations add '<ChangeName>' --context AuthDbContext --output-dir Migrations/AuthDb
```

The tracked baselines contain schema metadata only; they do not contain an
administrator, password hash, connection string, JWT key, or other secret.

## Self-contained production releases with spotctl

Production is deployed as one versioned release containing both applications:

```text
release-manifest.json
api/                         # self-contained ASP.NET Core application
ui/browser/                  # Angular production files served by Nginx
```

Build the release on the development/build machine from the application
directory. The builder targets the Raspberry Pi's 64-bit Linux ARM runtime
(`linux-arm64`), runs the locked Angular build, and publishes the API with its
own .NET runtime:

```bash
cd SpaceOfThoughtsWebApp
bash deployment/build-release.sh
```

The generated archive and its required SHA-256 checksum are written to the
repository's Git-ignored `artifacts/` directory:

```text
artifacts/spaceofthoughts-<release-id>-linux-arm64.tar.gz
artifacts/spaceofthoughts-<release-id>-linux-arm64.tar.gz.sha256
```

The production server does not need the application source, the .NET SDK, a
separately installed .NET/ASP.NET Core runtime, or `dotnet-ef`. It needs Bash 4
or newer, systemd, Nginx, a local PostgreSQL server, and the standard utilities
validated by `spotctl`. The archive contains compiled, reviewed EF migrations;
it contains no production environment file or secret.

For the first installation, copy both artifact files and the bootstrap files to
the server while preserving the `systemd/` subdirectory. The resulting staging
directory should look like this:

```text
/tmp/spaceofthoughts-bootstrap/
├── spaceofthoughts-<release-id>-linux-arm64.tar.gz
├── spaceofthoughts-<release-id>-linux-arm64.tar.gz.sha256
├── spotctl
└── systemd/
    └── spaceofthoughts.service
```

Run the interactive setup on the server:

```bash
cd /tmp/spaceofthoughts-bootstrap
sudo bash ./spotctl setup ./spaceofthoughts-<release-id>-linux-arm64.tar.gz
```

`spotctl` verifies the adjacent `.sha256` file and `linux-arm64` manifest before
installing anything. Setup asks twice for the administrator username, email,
and hidden password. It independently generates the PostgreSQL password and JWT
signing key, protects `/etc/spaceofthoughts/api.env` as `root:root` mode `0600`,
creates the local role and database, applies the tracked migrations, provisions
the sole `InitialAdmin`, installs the command and systemd unit, and enables boot
recovery.

Installed releases and persistent state are kept separate:

```text
/opt/spaceofthoughts/
├── releases/<release-id>/
│   ├── api/
│   └── ui/browser/
└── current -> releases/<release-id>

/etc/spaceofthoughts/api.env

/var/lib/spaceofthoughts/
├── images/
├── data-protection-keys/
└── backups/
```

Nginx serves Angular from `/opt/spaceofthoughts/current/ui/browser`. Uploaded
images, Data Protection keys, secrets, and database backups therefore survive
every release switch.

For an update, build a new release, copy its `.tar.gz` and `.sha256` files to
the server, and run:

```bash
sudo spotctl deploy /tmp/spaceofthoughts-<new-release-id>-linux-arm64.tar.gz
```

`spotctl deploy` validates and stages the new release while the old application
is still running. It then stops the service, creates protected environment and
PostgreSQL backups, atomically switches `current`, starts the new self-contained
API, and waits for `/health`. Normal API startup calls EF `MigrateAsync()` for
both contexts, so only pending migrations are applied; no production
`dotnet ef database update` command is needed.

List releases or switch application files back to an installed release with:

```bash
sudo spotctl releases
sudo spotctl rollback <release-id>
```

Rollback creates another protected recovery set and changes the API and Angular
release together. It never reverses EF migrations or automatically restores the
database, so the selected older application must remain compatible with the
current schema. Deploy and rollback print the exact protected backup paths.

First-time setup accepts a missing or empty `spotdb` but refuses a nonempty
unmanaged database. Normal crashes, dependency outages, and machine reboots
reuse the installed release and saved environment without prompting.

See the [secrets, deployment, rotation, and recovery runbook](SpaceOfThoughtsWebApp/deployment/SECRETS.md)
for the exact lifecycle, inspection commands, backups, and optional host paths.
See the [Cloudflare IPv6 DDNS runbook](SpaceOfThoughtsWebApp/deployment/ddns/README.md)
for the host-level DNS updater, protected configuration, and systemd timer.
See the [Let's Encrypt and Cloudflare runbook](SpaceOfThoughtsWebApp/deployment/LETSENCRYPT.md)
for certificate issuance, Nginx integration, and automatic DNS-based renewal.

## Run the API

From the repository root:

```bash
cd SpaceOfThoughtsWebApp/SpaceOfThoughts.API
dotnet restore
dotnet run --launch-profile https
```

The development API is available at:

- API: `https://localhost:7000`
- Swagger UI: `https://localhost:7000/swagger`

If necessary, create and trust a local HTTPS development certificate:

```bash
dotnet dev-certs https --trust
```

## Run the frontend

Open another terminal from the repository root:

```bash
cd SpaceOfThoughtsWebApp/SpaceOfThoughts.UI
npm ci
npm start
```

The Angular development server opens `http://localhost:4200`. Requests to
`/api` and `/Images` are proxied to `https://localhost:7000`.

## Build and test

API:

```bash
cd SpaceOfThoughtsWebApp/SpaceOfThoughts.API
dotnet build
```

Frontend:

```bash
cd SpaceOfThoughtsWebApp/SpaceOfThoughts.UI
npm run build
npm test
```

Run the image codec probe on a development machine or directly from a published
Linux ARM64 release without configuring the database or secrets:

```bash
./SpaceOfThoughts.API --probe-image-codecs
```

It performs a real WebP normalization round trip and an AVIF encode/decode
round trip through the bundled native library.

## Security notes

- Never commit database passwords, JWT signing keys, email-provider credentials,
  bootstrap administrator passwords, or production connection strings.
- Do not reuse development secrets in production.
- Rotate any credential that has previously been committed or publicly shared;
  deleting it from the README does not invalidate the exposed credential.
- The administrator password is accepted only over standard input during
  provisioning; it is never written to `api.env` or passed as a command argument.
- `BootstrapAdmin__UserName` and `BootstrapAdmin__Email` identify the protected
  account on later starts. Only that account may hold `InitialAdmin`; it also
  receives the `Reader` and `Writer` roles.
