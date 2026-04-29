const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('My bot is awake!'));

let port = process.env.PORT |

| 3000;
app.listen(port, () => console.log('Web server started'));

// Requesting only the most basic permissions to prevent crashes
const client = new Client({
    intents:
});

client.once('ready', () => {
    console.log(`Success! Logged in as ${client.user.tag}`);
});

// We added a.catch() here. If the login fails, it prints the error instead of crashing.
client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.log("LOGIN ERROR: Could not connect to Discord.");
    console.error(error);
});
