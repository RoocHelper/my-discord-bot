const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('My bot is awake!'));
app.listen(process.env.PORT |

| 3000, () => console.log('Web server started'));

const client = new Client({
  intents:
});

client.once('ready', () => {
    console.log(`Success! Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
