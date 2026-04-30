const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('My bot is awake!'));

let port = process.env.PORT |

| 3000;
app.listen(port, () => console.log('Web server started'));

// Connect to Discord
const client = new Client({
    intents:
});

// --- BOT MEMORY ---
// This stores the player limits and the names of who signed up.
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
            
            const eventId = Date.now().toString();

            // FIXED: Added the brackets so JavaScript knows these are empty lists!
            raidData[eventId] = {
                limits: { Sniper: 5, Priest: 2, Paladin: 1, DancerBard: 1, Bio: 1 },
                players: { Sniper:, Priest:, Paladin:, DancerBard:, Bio:, Bench:, Absent: }
            };

            const embed = generateRaidEmbed(eventId);
            const components = generateRaidComponents(eventId);

            await interaction.reply({ embeds: [embed], components: components });
        }
    }

    // 2. IF SOMEONE CLICKS A BUTTON OR DROPDOWN
    if (interaction.isButton() |

| interaction.isStringSelectMenu()) {
        
        const parts = interaction.customId.split('_');
        const eventId = interaction.isButton()? parts[1] : parts[2];
        
        // Figure out what class or status they clicked
        const choice = interaction.isButton()? parts[2] : interaction.values;

        const event = raidData[eventId];

        // If the raid is missing (bot restarted), give an error
        if (!event) {
            return interaction.reply({ content: "❌ This event expired.", ephemeral: true });
        }

        // Handle the "Late" statuses from your dropdown image 
        if (choice === 'Late' |

| choice === 'RemoveLate') {
            return interaction.reply({ content: `⏱️ Your status has been noted as: **${choice}**!`, ephemeral: true });
        }

        // Get the user's name
        const userName = interaction.user.username;

        // PREVENT DOUBLE SIGN-UPS: Remove the user from ALL lists first
        for (const key in event.players) {
            event.players[key] = event.players[key].filter(name => name!== userName);
        }

        // CHECK LIMITS: Check if the role they clicked is already full
        if (event.limits[choice] && event.players[choice].length >= event.limits[choice]) {
            return interaction.reply({ content: `❌ The **${choice}** role is already full!`, ephemeral: true });
        }

        // ADD THEM TO THE TEAM
        event.players[choice].push(userName);

        // RE-DRAW THE BOX
        const updatedEmbed = generateRaidEmbed(eventId);

        // THIS IS THE MAGIC: Instantly update the message box to show their name!
        await interaction.update({ embeds: [updatedEmbed] });
    }
});

// --- HELPER FUNCTION: DRAWS THE COLORED BOX ---
function generateRaidEmbed(eventId) {
    const event = raidData[eventId];
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

    // Added the actual dropdown options from your image!
    const selectMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`status_${eventId}`)
          .setPlaceholder('Select a status')
          .addOptions(
                { label: 'Bench', value: 'Bench', emoji: '🪑' },
                { label: 'Absent', value: 'Absent', emoji: '🅰️' },
                { label: 'Remove Late', value: 'RemoveLate', emoji: '❌' },
                { label: 'Late (+5 min)', value: 'Late', emoji: '⏱️' }
           )
    );

    return [buttons, selectMenu];
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.log("LOGIN ERROR: Could not connect to Discord.");
    console.error(error);
});
