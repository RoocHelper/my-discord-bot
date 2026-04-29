const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// 1. Create a tiny web page so Render keeps your bot alive
const app = express();
app.get('/', (req, res) => res.send('My bot is awake!'));

// We use an "if" statement here to completely avoid the symbol that was causing the crash
let port = process.env.PORT;
if (!port) {
    port = 3000;
}
app.listen(port, () => console.log('Web server started'));

// 2. Create your Discord bot with the correct intents
const client = new Client({ 
    intents:
});

client.once('ready', () => {
    console.log(`Success! Logged in as ${client.user.tag}`);
});

// 3. Log your bot into Discord
client.login(process.env.DISCORD_TOKEN);
