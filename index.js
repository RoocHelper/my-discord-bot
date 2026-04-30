const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('My bot is awake!'));

let port = process.env.PORT;
if (!port) {
    port = 3000;
}
app.listen(port, () => console.log('Web server started'));

// Connect to Discord
const client = new Client({
    intents: Object.keys(GatewayIntentBits).map((a) => {
        return GatewayIntentBits[a] 
    })
});

client.once('ready', async () => {
    console.log(`Success! Logged in as ${client.user.tag}`);
    
    // Tell Discord to create our slash command
    await client.application.commands.create({
        name: 'raid',
        description: 'Create a Raid-Helper style event!',
    });
    console.log('Raid command created!');
});

// Listen for users typing commands or clicking buttons
client.on('interactionCreate', async (interaction) => {
    
    // 1. If someone types /raid
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'raid') {

            // Check if the command is in the correct channel
            const allowedChannelId = '1499267462653280268';
            if (interaction.channelId!== allowedChannelId) {
                // Send a hidden warning if they are in the wrong channel
                await interaction.reply({ content: '❌ You can only use this command in the designated raid channel!', ephemeral: true });
                return; // This stops the bot from creating the event
            }

            // Create the visual box
            const embed = new EmbedBuilder()
               .setTitle('🛡️ Dragon Lair Raid')
               .setDescription('Click a button below to sign up for the raid!')
               .setColor(0x0099FF);

            // Create the interactive buttons
            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('Tank').setLabel('Tank 🛡️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('Healer').setLabel('Healer ➕').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('DPS').setLabel('DPS ⚔️').setStyle(ButtonStyle.Danger)
            );

            // Send it to the channel
            await interaction.reply({ embeds: [embed], components: [buttons] });
        }
    }

    // 2. If someone clicks a button
    if (interaction.isButton()) {
        // Send a hidden, temporary message confirming their sign up
        await interaction.reply({ 
            content: `✅ You signed up for the raid as a **${interaction.customId}**!`, 
            ephemeral: true 
        });
    }
});

client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.log("LOGIN ERROR");
    console.error(error);
});
