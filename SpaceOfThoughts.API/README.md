# SpaceOfThoughts.API

## Installation on Linux (tested on Ubuntu):

## 1. MySQL Database setup 

	sudo apt install mysql-server 
	sudo mysql_secure_installation

#### VALIDATE PASSWORD COMPONENT: no (because we are testing the blog in a sandbox environment we don't need a strong password)
#### Remove anonymous users?: yes
#### Disallow root login remotely?: yes
#### Remove test database and access to it?: yes
#### Reload privilege tables now?: yes

	sudo mysql

#### Use your usual admin password to get into MySQL
#### Now we need to setup a database that is matching our connection string setup 
#### Default credentials can be found in the "appsettings.json" 
#### "SpaceOfThoughtsConnectionString": "server=localhost;database=SPOT;User=root;Password=44059513;"

#### First we need to make sure that the root user has the same password as we set up in the connection string
	
	ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '44059513';
	FLUSH PRIVILEGES;

#### Create the SpaceOfThoughts aka SPOT database
	
	CREATE DATABASE SPOT;

#### Grant all privileges to the root user on the SPOT database
	
	GRANT ALL PRIVILEGES ON SPOT.* TO 'root'@'localhost';
	FLUSH PRIVILEGES;

#### Exit MySQL
	
	EXIT;

## 2. .NET Core Setup
	
	sudo apt install dotnet-sdk-8.0

#### Install the EF Core tools globally

	dotnet tool install --global dotnet-ef

#### To add it for the current terminal session, run:

	echo 'export PATH="$PATH:/home/$(whoami)/.dotnet/tools"' >> ~/.profile
	source ~/.profile

#### Check it the installation was successful

	dotnet ef --version

## 3. Database Migrations

#### First delete all files inside the Migrations folder

	sudo rm -rf Migrations/*

#### Now we need execute the database migrations

	dotnet ef migrations add InitialCreate --context ApplicationDbContext
	dotnet ef migrations add InitialCreateAuth --context AuthDbContext
	dotnet ef database update --context ApplicationDbContext
	dotnet ef database update --context AuthDbContext

## 4. Finally start the API

#### Install a self signed development certificate (The warning in the terminal after running the API will persist, but that is a bug that has been fixed in .NET 9)

	mkdir -p $HOME/.pki/nssdb
	dotnet dev-certs https
	sudo -E dotnet dev-certs https -ep /usr/local/share/ca-certificates/aspnet-dev-$(whoami).crt --format PEM
	sudo chmod 644 /usr/local/share/ca-certificates/aspnet-dev-$(whoami).crt
	certutil -d sql:$HOME/.pki/nssdb -A -t "P,," -n localhost -i /usr/local/share/ca-certificates/aspnet-dev-$(whoami).crt
	sudo update-ca-certificates

### Run the application

	sudo dotnet run

## 5. Next follow the installation instructions in the UI README

[SpaceOfThoughts.UI](https://github.com/jfauser1395/SpaceOfThoughts.UI?tab=readme-ov-file)

	
