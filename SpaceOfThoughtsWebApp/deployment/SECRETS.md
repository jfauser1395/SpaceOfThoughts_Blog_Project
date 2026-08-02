# SpaceOfThoughts production deployment, secrets, and recovery

`spotctl` is the supported production administration command for a Linux host
running systemd and a local PostgreSQL server. It installs immutable combined
API/UI releases, generates secrets, creates the database, invokes the API's
tracked EF migrations, provisions the sole `InitialAdmin`, and manages release
switching and recovery.

Production releases are built on a development or CI machine, not on the
server. From the `SpaceOfThoughtsWebApp` directory, run:

```bash
bash deployment/build-release.sh
```

The builder runs `npm ci`, produces the Angular production application, and
publishes the ASP.NET Core API as a self-contained `linux-arm64` application.
It writes a combined archive and its required SHA-256 checksum to the
repository's Git-ignored `artifacts/` directory:

```text
artifacts/spaceofthoughts-<release-id>-linux-arm64.tar.gz
artifacts/spaceofthoughts-<release-id>-linux-arm64.tar.gz.sha256
```

For the bootstrap only, copy both artifact files, `deployment/spotctl`, and
`deployment/systemd/spaceofthoughts.service` to the server. Preserve the
`systemd/` subdirectory so the staging layout is:

```text
/tmp/spaceofthoughts-bootstrap/
├── spaceofthoughts-<release-id>-linux-arm64.tar.gz
├── spaceofthoughts-<release-id>-linux-arm64.tar.gz.sha256
├── spotctl
└── systemd/
    └── spaceofthoughts.service
```

Run the first setup from that server-side staging directory:

```bash
cd /tmp/spaceofthoughts-bootstrap
sudo bash ./spotctl setup ./spaceofthoughts-<release-id>-linux-arm64.tar.gz
```

Setup installs the command as `/usr/local/sbin/spotctl`. Later operations use:

```bash
sudo spotctl deploy /tmp/spaceofthoughts-<new-release-id>-linux-arm64.tar.gz
sudo spotctl releases
sudo spotctl rollback <release-id>
sudo spotctl restart
sudo spotctl reconfigure
sudo spotctl status
sudo spotctl logs
sudo spotctl doctor
```

## First setup

The archive and checksum must remain next to each other and retain matching
names. Before extraction, `spotctl` verifies the SHA-256 digest, rejects unsafe
archive paths and links, validates the release manifest, and confirms that its
runtime identifier matches the server. The supplied builder targets
`linux-arm64`, which is the 64-bit ARM runtime used by the Raspberry Pi host.

`sudo bash ./spotctl setup RELEASE` asks for the administrator username, email,
and password twice. Password input is hidden. The command then:

1. Installs the root-owned release below `/opt/spaceofthoughts/releases` and
   atomically points `/opt/spaceofthoughts/current` at it.
2. Generates a 256-bit hexadecimal PostgreSQL password.
3. Generates a random 384-bit Base64 JWT signing key.
4. Creates or updates the fixed local PostgreSQL role `spaceofthoughts`.
5. Creates the database `spotdb` when it does not exist.
6. Writes `/etc/spaceofthoughts/api.env` atomically.
7. Runs the API's provisioning mode, which applies both tracked EF migration
   sets and creates or updates the sole `InitialAdmin` through ASP.NET Identity.
8. Installs, enables, and starts `spaceofthoughts.service`.
9. Waits for `http://127.0.0.1:5000/health`.

Setup creates a missing database or adopts an existing database only when it
contains no user tables. It refuses a nonempty database when no managed
`api.env` exists, preventing an accidental migration or administrator rewrite
of an unrelated or incompletely recovered database. Recover an existing
installation from its protected environment and database backups instead of
running first-time setup over it.

EF migration source files are generated during development, reviewed, and
tracked with the release. Setup applies them automatically; it does not generate
unreviewed migration source on the production host.

The release contains the compiled API, its own .NET/ASP.NET Core runtime, and
the Angular production files. The production server therefore needs no .NET
SDK, separately installed .NET runtime, `dotnet-ef`, or application source code.

The administrator password is sent to the provisioning process only through
standard input. It is hashed by ASP.NET Identity and is never written to
`api.env`, a command argument, or a log. The PostgreSQL password and JWT key are
independent random values and are not derived from the administrator password.

## Release and persistent-data layout

The active application is a symbolic link to one immutable release:

```text
/opt/spaceofthoughts/
├── releases/
│   ├── <older-release-id>/
│   │   ├── api/
│   │   └── ui/browser/
│   └── <active-release-id>/
│       ├── api/
│       └── ui/browser/
└── current -> releases/<active-release-id>
```

Systemd executes
`/opt/spaceofthoughts/current/api/SpaceOfThoughts.API`. Nginx serves Angular's
`dist` output from `/opt/spaceofthoughts/current/ui/browser`, so one `current`
switch activates the matching API and UI together.

Mutable data is deliberately outside every release:

```text
/etc/spaceofthoughts/
├── api.env
└── spotctl.conf                 # optional, root-controlled overrides

/var/lib/spaceofthoughts/
├── images/
├── data-protection-keys/
└── backups/
```

Uploaded images, Data Protection keys, environment configuration, PostgreSQL
data, and protected recovery files therefore survive deployment and rollback.

## Environment-file protection

`spotctl` creates and verifies these permissions automatically:

```text
drwx------ root:root /etc/spaceofthoughts
-rw------- root:root /etc/spaceofthoughts/api.env
```

The root systemd manager reads the protected file before starting the API as the
unprivileged `spaceofthoughts` account. ASP.NET Core maps double underscores to
configuration sections, for example `Jwt__Key` to `Jwt:Key`.

The default service group is `www-data`, allowing Nginx to read public uploads
with group-read permissions. The private image directory remains owner-only,
and Data Protection keys remain mode `0700`. The state root is owned by root,
and the root-only backup directory cannot be replaced by the API service user.

Inspect names without revealing values:

```bash
sudo sed -E 's/=.*/=<redacted>/' /etc/spaceofthoughts/api.env
```

Viewing the complete file exposes the database password and JWT signing key:

```bash
sudo less /etc/spaceofthoughts/api.env
```

Do not copy those values into shell history, issue trackers, chat, or logs.

Keep a DDNS provider token out of `api.env`: the API does not need it. Store it
in a separate root-only environment file referenced only by the DDNS updater's
systemd unit, so an API compromise does not also expose DNS control. The
[DDNS runbook](ddns/README.md) installs that credential as
`/etc/spaceofthoughts/ddns.env` with mode `0600`.

## Deploying an application update

Build every update with the same release builder:

```bash
cd SpaceOfThoughtsWebApp
bash deployment/build-release.sh
```

Copy the new `.tar.gz` and its adjacent `.tar.gz.sha256` file to the server. The
installed command and systemd template do not need to be copied again for a
normal update. Deploy the archive itself, not the checksum path:

```bash
sudo spotctl deploy /tmp/spaceofthoughts-<new-release-id>-linux-arm64.tar.gz
```

Deployment performs these operations in order:

1. Verifies the SHA-256 checksum, archive safety, manifest, `linux-arm64` RID,
   native API executable, and Angular `ui/browser/index.html`.
2. Stages the new immutable release while the old release remains live.
3. Stops the API and creates root-only backups of `api.env` and PostgreSQL.
4. Atomically changes `/opt/spaceofthoughts/current` to the new combined API/UI
   release.
5. Starts the self-contained API and waits up to 60 seconds for `/health`.

Every normal API startup calls `MigrateAsync()` for `ApplicationDbContext` and
`AuthDbContext`. EF consults each `__EFMigrationsHistory` table and applies only
pending migrations before Kestrel begins serving requests. Updating production
therefore never requires `dotnet ef database update`, `dotnet-ef`, or the source
tree.

If the new service does not become healthy, `spotctl` leaves that release
selected for diagnosis and prints the attempted release, previous release, and
exact protected environment/database backup paths. It never guesses that an
automatic database restore is safe.

List the retained releases and their active marker with:

```bash
sudo spotctl releases
```

To activate an older installed release, run:

```bash
sudo spotctl rollback <release-id>
```

Rollback asks for confirmation, stops the service, creates a fresh protected
environment/database backup, switches the API and Angular UI together, starts
the target, and checks `/health`. It **never reverses EF migrations and never
automatically restores the database**. Confirm that the older application is
compatible with the current schema. The command prints the backup paths and
retains both application releases.

## Restarts and recovery

These events never prompt for credentials:

- API crashes
- dependency outages
- system shutdowns and reboots
- direct `sudo systemctl restart spaceofthoughts.service`

Systemd resolves the same `current` link, reloads the same protected environment
file, and reuses the persistent Data Protection keys under
`/var/lib/spaceofthoughts/data-protection-keys`. The service uses
`Restart=on-failure` and is enabled at boot.

`sudo spotctl restart` is for an interactive restart without installing a new
release. Answering yes retains every current credential and first creates
protected environment and database backups. Answering no performs the same
operation as `sudo spotctl reconfigure`.

A direct `systemctl restart` deliberately skips the prompt and backup. Use
`spotctl deploy RELEASE`—not `spotctl restart`—for an application update.

Reconfiguration stops the API, creates protected environment and PostgreSQL
backups, prompts for administrator values twice, generates a new PostgreSQL
password and JWT key, updates the sole `InitialAdmin`, and starts the API again.
JWT rotation invalidates existing login tokens, so every user must log in again.

Backups are root-only files under:

```text
/var/lib/spaceofthoughts/backups
```

Deploy, rollback, restart, and reconfiguration print the backup paths they
create. These files contain secrets and database content and must be included
only in encrypted server backups. The deployment backup does not contain
uploaded images or Data Protection keys. A power outage is handled
automatically; disk loss requires an external backup of the database, `api.env`,
uploaded images, and Data Protection keys.

## Optional host settings

The defaults match the supplied systemd and Nginx deployment. Before first
setup, a root administrator may create `/etc/spaceofthoughts/spotctl.conf` to
override settings such as `INSTALL_ROOT`, `RELEASES_DIR`, `CURRENT_LINK`,
`STATE_DIR`, `IMAGE_DIR`, `DATA_PROTECTION_DIR`, `DB_NAME`, `DB_ROLE`,
`DB_PORT`, `JWT_ISSUER`, `JWT_AUDIENCE`, `API_URL`, or `HEALTH_URL`.

PostgreSQL remains local at `127.0.0.1`. If the application directory, state
directory, or API URL changes, spotctl derives the corresponding native API,
Data Protection, image, or health path unless that dependent setting is also
overridden. Release paths must retain the required `current/api` and
`current/ui/browser` layout. Coordinate application paths and ports with the
systemd and Nginx configuration. Changing `SERVICE_GROUP` also requires
preserving Nginx read access to public images.

This is trusted Bash configuration, so it must be owned by root and must not be
writable by a group or other users:

```bash
sudo chown root:root /etc/spaceofthoughts/spotctl.conf
sudo chmod 600 /etc/spaceofthoughts/spotctl.conf
```

Do not place secret values in `spotctl.conf`; generated secrets belong only in
`api.env`.
