workspace {

    model {
        user = person "User" "People that are visiting and participating on the Blog." "user"
        admin = person "Administrator" "Administrator is uploading new content on the Blog" "admin"

        softwareSystem = softwareSystem "Blogging Website" "My Blogging" {
            WebApplication = container "Web Application" "Delivers static and dynamic content via a single page application" "ASP.NET Core Web API & Angular UI" "
            api = container "API Application" "Provides functionalities to execute CRUD operations via a REST API." "ASP.NET Core 8 & Entity Framework" "API"
            database = container "Database" "All data is stored in a MySql Server to process queries." "Relational database schema (many-to-many relation)" "Database"
            singlePageApplication = container "Single-Page Application" "Provides all blogging functionality to users via their web browser." "TypeScript and Angular" "Web Browser"
            pwa = container "Mobile App as PWA" "Provides all functionalities on a mobile device without the use of an appstore." "Angular PWA Service Worker" "Mobile PWA"
           
        }
      

        
        user -> webApplication "Visits spaceofthougsts.com using" "HTTPS"
        admin -> webApplication "Visits spaceofthougsts.com to upload, edit and monitor content using" "HTTPS"
        webApplication -> singlePageApplication "Delivers to user's web browser"
        singlePageApplication -> api "Makes API calls to" "JSON/HTTPS"
        singlePageApplication -> pwa "Allows the user to experience a mobile application"
        api -> Database "Reads from and writes to"
       
       
    }

    views {
        systemContext softwareSystem "Diagram1" {
            include *
            autoLayout 
        }
        container softwareSystem "Diagram2" {
            include *  
            
        }
        styles {
           
            element "admin" {
                shape person
                background #08427b
                color #ffffff
            }
            element "user" {
                shape person
                background #999999
            }

             element "Software System" {
                background #1168bd
                color #ffffff
            }
            element "Database" {
                shape cylinder
            }
            element "Container" {
                background #438dd5
                color #ffffff
                shape roundedbox
            }
            element "Web Browser" {
                shape WebBrowser
            }
            element "Mobile PWA" {
                shape MobileDevicePortrait
            }
        }
    }
    
}