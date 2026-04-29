const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// This creates a tiny web page so Render keeps your bot alive
const app = express();
app.get('/', (req, res) => res.send('My bot is awake!'));
app.listen(process.env.PORT |

| 3000, () => console.log('Web server started'));

// This creates your Discord bot
const client = new Client({ 
  intents: 
});

client.once('ready', () => {
    console.log(`Success! Logged in as ${client.user.tag}`);
});

// This logs your bot into Discord
client.login(process.env.DISCORD_TOKEN);
