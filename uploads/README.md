# Taskly - Your favourite teams collaboration software!

Taskly allows you to collaborate and track tasks with an intuitive and easy-to-use interface designed with HCI principles in mind that will streamline your workflow and take the mental strain away from your mind, so you can focus on being the best version of yourself! 


## Steps to run from source
    Clone Taskly locally from GitLab
    Obtain .env file containing sensitive remote database authentication information
    Move .env to /backend/.env
    Change directory back to the topmost directory and run
    npm install
    npm run dev
    Open localhost:8080 in your browser and start using Taskly!


## Testing Backend

Use Postman to send a POST request to:

    http://localhost:3000/register
    http://localhost:3000/login

With JSON body:

`{ 
    "username": "your_username",
    "password": "your_password" 
}`