
### [:warning: Finish API setup first and return after :warning:](https://github.com/jfauser1395/SpaceOfThoughts.API)

# SpaceOfThoughts.UI

## Prerequisites

Before you start please make sure Node.js is installed:

```sh
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.2.2.
Please install the CLI:

```sh
sudo npm install -g @angular/cli
```

## Start the application

First make sure that you are running the API in another terminal as explained in the API *README* file. After cloning the UI repository navigate into the root directory and run:

 ```sh 
 npm install
 ```
to install all project dependency. 

After that run: 

```sh
ng serve
``` 
to start the dev server. Navigate to `http://localhost:4200/` or Press `o + Enter` to open in the system's default browser.

## Login into the application

To test out admin functionalities login with credentials that are set up in the *API's AuthDbContext.cs* file. If you haven't change the initial setup of the API the default credentials are: "email: `admin@test.com`, password: `Admin@123`".

## Alternatively use the automated setup

After cloning the repo open the setup.sh file and comment out all packages that you already have installed on your machine and run:

 ```sh 
chmod +x SpaceOfThoughts.UI/setup.sh
./SpaceOfThoughts.UI/setup.sh
 ```
 change the path if necessary.