# automation-nodejs

This application utilizes Node.js, MongoDB, Puppeteer, Twitter API v2, Socket.IO, and Express to simulate a home automation system. It checks the temperature and luminosity of the city of Granada by performing web scraping with Puppeteer on weather.com.

## Execution
To run the application, follow the steps below:

1. Make sure you have Node.js and MongoDB installed on your system.

2. Clone this repository to your local machine.

3. Navigate to the root directory of the repository.

4. Install the required dependencies by running the command `npm install` in your terminal.

5. Start the Node.js server by running the command `node server.js`.

6. Open a web browser and visit `localhost:8080`. Here you will find the status of the sensors and the appliances in the home automation system.

7. To modify the sensor values, visit `localhost:8080/admin`. This will provide you with an interface to update the sensor values.

Please note that the Twitter account used in this application is for testing purposes only, and you don't need to worry about the credentials being exposed.

By following these steps, you will be able to execute the automation-nodejs application. The web browser will display the current status of the sensors and appliances, while the admin interface allows you to modify the sensor values according to your requirements.
