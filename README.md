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

## Local configuration

The API reads configuration through the standard ASP.NET Core configuration
system. Required configuration keys include:

- `ConnectionStrings:SpaceOfThoughtsConnectionString`
- `Jwt:Key`
- `Jwt:Issuer`
- `Jwt:Audience`

Do not put passwords, signing keys, API keys, or other credentials in this
README or in tracked configuration files.

For local development, store sensitive values with .NET User Secrets:

```powershell
cd SpaceOfThoughtsWebApp/SpaceOfThoughts.API
dotnet user-secrets set "ConnectionStrings:SpaceOfThoughtsConnectionString" "Host=localhost;Port=5432;Database=spotdb;Username=postgres;Password=<your PostgreSQL password>"
dotnet user-secrets set "Jwt:Key" "<your long random development signing key>"
```

The development issuer and audience are:

```text
Jwt:Issuer   = https://localhost:7000
Jwt:Audience = http://localhost:4200
```

.NET User Secrets are intended only for local development. Use environment
variables or a managed secret store in production. Nested configuration keys
use double underscores in environment variables, for example `Jwt__Key`.

## Database setup

The project uses the Npgsql Entity Framework Core provider for PostgreSQL.
Migration files are intentionally excluded from Git. After cloning the
repository, create an empty local database and generate fresh migrations for
both database contexts before starting the API:

```powershell
createdb --host localhost --username postgres spotdb
cd SpaceOfThoughtsWebApp/SpaceOfThoughts.API
dotnet tool install --global dotnet-ef --version 10.0.10
dotnet ef migrations add InitialApplication --context ApplicationDbContext --output-dir Migrations/ApplicationDb
dotnet ef migrations add InitialAuth --context AuthDbContext --output-dir Migrations/AuthDb
```

If `dotnet-ef` is already installed, update it before generating the migrations:

```powershell
dotnet tool update --global dotnet-ef --version 10.0.10
```

The API applies the generated migrations automatically when it starts. To apply
them manually instead, run:

```powershell
cd SpaceOfThoughtsWebApp/SpaceOfThoughts.API
dotnet ef database update --context ApplicationDbContext
dotnet ef database update --context AuthDbContext
```

## Run the API

From the repository root:

```powershell
cd SpaceOfThoughtsWebApp/SpaceOfThoughts.API
dotnet restore
dotnet run --launch-profile https
```

The development API is available at:

- API: `https://localhost:7000`
- Swagger UI: `https://localhost:7000/swagger`

If necessary, create and trust a local HTTPS development certificate:

```powershell
dotnet dev-certs https --trust
```

## Run the frontend

Open another terminal from the repository root:

```powershell
cd SpaceOfThoughtsWebApp/SpaceOfThoughts.UI
npm ci
npm start
```

The Angular development server opens `http://localhost:4200`. Requests to
`/api` and `/Images` are proxied to `https://localhost:7000`.

## Build and test

API:

```powershell
cd SpaceOfThoughtsWebApp/SpaceOfThoughts.API
dotnet build
```

Frontend:

```powershell
cd SpaceOfThoughtsWebApp/SpaceOfThoughts.UI
npm run build
npm test
```

## Security notes

- Never commit database passwords, JWT signing keys, email-provider credentials,
  bootstrap administrator passwords, or production connection strings.
- Do not reuse development secrets in production.
- Rotate any credential that has previously been committed or publicly shared;
  deleting it from the README does not invalidate the exposed credential.
- Bootstrap administrator credentials are intentionally not documented here.
  Replace any hard-coded bootstrap credential with secret-backed configuration
  before deploying the application outside a local development environment.
