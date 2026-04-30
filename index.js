const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('My bot is awake!'));

let port = process.env.PORT;
if (!port) {
    port = 3000;
}
app.listen(port, () => console.log('Web server started'));

const client = new Client({
    intents: Object.keys(GatewayIntentBits).map((a) => {
        return GatewayIntentBits[a] 
    })
});

// --- BOT MEMORY ---
// This stores the player limits and the names of who signed up.
// (Note: Because this is simple memory, it will clear if Render goes to sleep/restarts)
const raidData = {};

client.once('ready', async () => {
    console.log(`Success! Logged in as ${client.user.tag}`);
    await client.application.commands.create({
        name: 'raid',
        description: 'Create a Raid-Helper style event!',
    });
    console.log('Raid command created!');
});

client.on('interactionCreate', async (interaction) => {
    
    // 1. IF SOMEONE TYPES /RAID
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'raid') {
            
            // Generate a unique ID for this specific raid
            const eventId = Date.now().toString();

            // Setup the team limits and empty lists in the bot's memory
            raidData[eventId] = {
                limits: { Sniper: 5, Priest: 2, Paladin: 1, DancerBard: 1, Bio: 1 },
                players: { Sniper:, Priest:, Paladin:, DancerBard:, Bio:, Bench:, Absent: }
            };

            // Build the visual box and buttons using our helper functions below
            const embed = generateRaidEmbed(eventId);
            const components = generateRaidComponents(eventId);

            await interaction.reply({ embeds: [embed], components: components });
        }
    }

    // 2. IF SOMEONE CLICKS A BUTTON OR DROPDOWN
    if (interaction.isButton() |

| interaction.isStringSelectMenu()) {
        
        // We attached the eventId to the buttons, let's extract it
        const parts = interaction.customId.split('_');
        const eventId = interaction.isButton()? parts[1] : parts[2];
        
        // Figure out what class or status they clicked
        const choice = interaction.isButton()? parts[2] : interaction.values;

        // Find the raid in the bot's memory
        const event = raidData[eventId];

        // If the raid is missing (bot restarted), give an error
        if (!event) {
            return interaction.reply({ content: "❌ This event expired because the bot restarted.", ephemeral: true });
        }

        // Handle the "Late" statuses from your dropdown image (Hidden message only for now)
        if (choice === 'Late' |

| choice === 'RemoveLate') {
            return interaction.reply({ content: `⏱️ Your status has been noted as: **${choice}**!`, ephemeral: true });
        }

        const userName = interaction.user.username;

        // PREVENT DOUBLE SIGN-UPS: Remove the user from ALL lists first
        for (const key in event.players) {
            event.players[key] = event.players[key].filter(name => name!== userName);
        }

        // CHECK LIMITS: Check if the role they clicked is already full
        if (event.limits[choice] && event.players[choice].length >= event.limits[choice]) {
            return interaction.reply({ content: `❌ The **${choice}** role is already full!`, ephemeral: true });
        }

        // ADD THEM TO THE TEAM: Put their name in the correct list
        event.players[choice].push(userName);

        // RE-DRAW THE BOX: Re-generate the embed with the new names
        const updatedEmbed = generateRaidEmbed(eventId);

        // UPDATE THE MESSAGE: This instantly changes the old box to the new box!
        await interaction.update({ embeds: [updatedEmbed] });
    }
});

// --- HELPER FUNCTION: DRAWS THE COLORED BOX ---
function generateRaidEmbed(eventId) {
    const event = raidData[eventId];

    // A tiny tool to format the names cleanly, or show a '-' if nobody signed up yet
    const formatList = (list) => list.length > 0? list.join('\n') : '-';

    return new EmbedBuilder()
       .setTitle("FREYA NIGHTMARE JUM'AT")
       .setColor('#F1C40F')
       .setDescription('**Event Info:**\n📅 5/1/2026\n🕒 9:00 PM - None\n\n')
       .addFields(
            { name: `🎯 Sniper (${event.players.Sniper.length}/${event.limits.Sniper})`, value: formatList(event.players.Sniper), inline: true },
            { name: `⛑️ Priest (${event.players.Priest.length}/${event.limits.Priest})`, value: formatList(event.players.Priest), inline: true },
            { name: `🛡️ Paladin (${event.players.Paladin.length}/${event.limits.Paladin})`, value: formatList(event.players.Paladin), inline: true },
            { name: `🎸 DancerBard (${event.players.DancerBard.length}/${event.limits.DancerBard})`, value: formatList(event.players.DancerBard), inline: true },
            { name: `🧪 Bio (${event.players.Bio.length}/${event.limits.Bio})`, value: formatList(event.players.Bio), inline: true },
            { name: '\u200b', value: '----------------------------------------', inline: false },
            { name: `🪑 Bench (${event.players.Bench.length})`, value: formatList(event.players.Bench), inline: true },
            { name: `🅰️ Absent (${event.players.Absent.length})`, value: formatList(event.players.Absent), inline: true }
        )
       .setFooter({ text: `Event ID: ${eventId}\nEvent start time • Tomorrow at 9:00 PM` });
}

// --- HELPER FUNCTION: DRAWS THE BUTTONS & DROPDOWN ---
function generateRaidComponents(eventId) {
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`role_Sniper_${eventId}`).setLabel('Sniper').setEmoji('🎯').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`role_Priest_${eventId}`).setLabel('Priest').setEmoji('⛑️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`role_Paladin_${eventId}`).setLabel('Paladin').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`role_DancerBard_${eventId}`).setLabel('DancerBard').setEmoji('🎸').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`role_Bio_${eventId}`).setLabel('Bio').setEmoji('🧪').setStyle(ButtonStyle.Secondary)
    );

    // This matches the dropdown menu from your second image!
    const selectMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
           .setCustomId(`status_${eventId}`)
           .setPlaceholder('Select a status')
           .addOptions()
    );

    return [buttons, selectMenu];
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.log("LOGIN ERROR: Could not connect to Discord.");
    console.error(error);
});
