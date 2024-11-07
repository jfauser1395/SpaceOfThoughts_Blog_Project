# Blog project setup API and UI

This setup manual is designed for Linux, specifically tested on Ubuntu 24.04 LTS. Follow the installation steps carefully. Alternatively, refer to the automated setup at the end of this README.

## 1. MySQL Database setup 

Install MySQL server:

```
sudo apt install mysql-server 
```
MySQL secure installation:

```
sudo mysql_secure_installation (optional)
```

## MySQL secure setup
| configuration| option |
| ------ | ----------- |
| VALIDATE PASSWORD COMPONENT| `no` (if testing in a sandbox environment)|
| Remove anonymous users? | `yes` |
| Disallow root login remotely?| `yes`|
| Remove test database and access to it? | `yes` |
| Reload privilege tables now? | `yes`|

Login into MySQL Server:

``` 
sudo mysql
```
Use your usual admin password to get into MySQL
Now we need to setup a database that is matching our connection string setup 
Default credentials can be found in the "appsettings.json": 
`"SpaceOfThoughtsConnectionString": "server=localhost;database=SPOT;User=root;Password=44059513;"`

**First we need to make sure that the root user has the same password as we set up in the connection string**

```sql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '44059513';
FLUSH PRIVILEGES;
```

**Create the SpaceOfThoughts aka SPOT database**

```sql	
CREATE DATABASE SPOT;
```

**Grant all privileges to the root user on the SPOT database**

 ```sql
GRANT ALL PRIVILEGES ON SPOT.* TO 'root'@'localhost';
FLUSH PRIVILEGES;
```

**Exit MySQL**

```sql
EXIT;
```

## 2. .NET 8 Core Setup

Install the sdk:

``` 
sudo apt install dotnet-sdk-8.0
```

Install the EF Core tools globally:

```
dotnet tool install --global dotnet-ef
```

To add it for the current terminal session, run:

```
echo 'export PATH="$PATH:/home/$(whoami)/.dotnet/tools"' >> ~/.profile
source ~/.profile
```

Check it the installation was successful:

```
dotnet ef --version
```

## 3. Database Migration

First navigate into the API folder and delete all files inside the Migrations folder:

```
cd blog-project-web-development/SpaceOfThoughts.API/
sudo rm -rf Migrations/*
```

Now we need execute the database migrations:

```
dotnet ef migrations add InitialCreate --context ApplicationDbContext
dotnet ef migrations add InitialCreateAuth --context AuthDbContext
dotnet ef database update --context ApplicationDbContext
dotnet ef database update --context AuthDbContext
```

## 4. Finally start the API

Install a self signed development certificate:

```
mkdir -p $HOME/.pki/nssdb
dotnet dev-certs https
sudo -E dotnet dev-certs https -ep /usr/local/share/ca-certificates/aspnet-dev-$(whoami).crt --format PEM
sudo chmod 644 /usr/local/share/ca-certificates/aspnet-dev-$(whoami).crt
certutil -d sql:$HOME/.pki/nssdb -A -t "P,," -n localhost -i /usr/local/share/ca-certificates/aspnet-dev-$(whoami).crt
sudo update-ca-certificates
```

Run the application:

```
dotnet run
```

## 5. Prerequisites

### Open a new terminal and navigate to the UI folder

Before you start please make sure Node.js is installed:

```
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.2.2.
Please install the CLI:

```
sudo npm install -g @angular/cli
```

## 6. Start the application

**First make sure that you are running the API in another terminal as explained above**

Navigate into the UI folder and install all dependencies:

```
cd ./blog-project-web-development/SpaceOfThoughts.UI
npm install
```

Start the frontend application:

```
ng serve
```

The application will start on it's own alternatively navigate to `http://localhost:4200/` or Press `o + Enter` to open in the system's default browser.

## Login into the application

To test out admin functionalities login with credentials that are set up in the *API's AuthDbContext.cs* file. If you haven't change the initial setup of the API the default credentials are: "email: `admin@test.com`, password: `Admin@123`".

# Alternatively use the automated setup

After cloning the repo open the setup.sh file and comment out all packages that you already have installed on your machine and run:

 ```
chmod +x SpaceOfThoughts.UI/setup.sh
./blog-project-web-development/SpaceOfThoughts.UI/setup.sh
 ```
 change the path if necessary.