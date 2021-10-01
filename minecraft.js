// CONFIGURE THESE VALUES FIRST
// ----------------------------

// Your secure auth token, found at https://www.twilio.com/user/account
var TWILIO_AUTH_TOKEN = 'wwwxxxyyyzzz';

// An administrator's phone number
var ADMIN_PHONE = '+16518675309';

// Your server's public IP address
var IP_ADDRESS = '127.0.0.1';

// Begin Server Implementation
// ---------------------------

// Dependencies
var spawn = require('child_process').spawn;
var twilio = require('twilio');
var express = require('express');
var bodyParser = require('body-parser');

// Our Minecraft multiplayer server process
var minecraftServerProcess = spawn('java', [
    '-Xmx512M',
    '-Xms256M',
    '-jar',
    'minecraft_server.1.8.jar',
    'nogui'
]);

// Log server output to stdout
function log(data) {
    process.stdout.write(data.toString());
}
minecraftServerProcess.stdout.on('data', log);
minecraftServerProcess.stderr.on('data', log);

// Create an express web app
var app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// Handle Admin Command requests
app.post('/command', twilio.webhook(TWILIO_AUTH_TOKEN, {
    url: 'http://' + IP_ADDRESS + ':3000/command'
}), function(request, response) {
    // Cancel processing if the message was not sent by an admin
    if (request.param('From') !==  ADMIN_PHONE ){
        response.status(403).send('you are not an admin :(');
        return;
    }

    // Get the admin command and send it to the Minecraft server
    var command = request.param('Body');
    minecraftServerProcess.stdin.write(command+'\n');

    // buffer output for a quarter of a second, then reply to HTTP request
    var buffer = [];
    var collector = function(data) {
        data = data.toString();
        // Split to omit timestamp and junk from Minecraft server output
        buffer.push(data.split(']: ')[1]);
    };
    minecraftServerProcess.stdout.on('data', collector);

    // Delay for a bit, then send a response with the latest server output
    setTimeout(function() {
        minecraftServerProcess.stdout.removeListener('data', collector);

        // create a TwiML response with the output of the Minecraft server
        var twiml = new twilio.TwimlResponse();
        twiml.message(buffer.join(''));

        response.type('text/xml');
        response.send(twiml.toString());
    }, 250);
});

// Listen for incoming HTTP requests on port 3000
app.listen(3000);

// Make sure the Minecraft server dies with this process
process.on('exit', function() {
    minecraftServerProcess.kill();
});
