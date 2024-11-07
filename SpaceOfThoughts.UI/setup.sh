#!/bin/bash

# Download the API Repo
git clone https://github.com/jfauser1395/SpaceOfThoughts.API.git

# Download and install nodejs version 20.x.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Download and install Angular CLI
sudo npm install -g @angular/cli

# Download and install MySQL Server
sudo apt install -y mysql-server

# Setup the project's default database
sudo mysql < SpaceOfThoughts.UI/InstallationScript/mysql_commands.sql

# Download and install .Net SDK
sudo apt install -y dotnet-sdk-8.0

# Download and install EF framework Core
dotnet tool install --global dotnet-ef

# Update PATH for the EF framework
echo 'export PATH="$PATH:/home/$(whoami)/.dotnet/tools"' >> ~/.profile
source ~/.profile

# Setup the API

# Database migration
cd SpaceOfThoughts.API/
sudo rm -rf Migrations/*
dotnet ef migrations add InitialCreate --context ApplicationDbContext
dotnet ef migrations add InitialCreateAuth --context AuthDbContext
dotnet ef database update --context ApplicationDbContext
dotnet ef database update --context AuthDbContext

# Install self signed certificate
sudo apt install libnss3-tools
mkdir -p $HOME/.pki/nssdb
dotnet dev-certs https
sudo -E dotnet dev-certs https -ep /usr/local/share/ca-certificates/aspnet-dev-$(whoami).crt --format PEM
sudo chmod 644 /usr/local/share/ca-certificates/aspnet-dev-$(whoami).crt
certutil -d sql:$HOME/.pki/nssdb -A -t "P,," -n localhost -i /usr/local/share/ca-certificates/aspnet-dev-$(whoami).crt
sudo update-ca-certificates

# Run the API
dotnet run &

# Open a new terminal window to run npm install and ng serve
# The Angular CLI will ask if you want to activate the autosuggestion functionality type y or n according to your preferance
gnome-terminal -- bash -c "cd ~/SpaceOfThoughts.UI && npm install && ng serve; exec bash"  