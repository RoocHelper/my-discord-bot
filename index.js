const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('My bot is awake!'));

let port = process.env.PORT;
if (!port) {
    port = 3000;}
app.listen(port, () => console.log('Web server started'));

// The intents array is now properly filled out
const client = new Client({
    intents:
});

client.once('ready', () => {
    console.log(`Success! Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
