const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('My bot is awake!'));

// Avoiding the problematic symbols for the port
let port = process.env.PORT;
if (!port) {
    port = 3000;
}
app.listen(port, () => console.log('Web server started'));

// Avoiding empty brackets for intents
const client = new Client({
    intents: new Array(
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    )
});

// BOT MEMORY: Stores the limits and player names
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

            // Avoiding square brackets for empty lists so they don't disappear when copying
            raidData[eventId] = {
                limits: { Sniper: 5, Priest: 2, Paladin: 1, DancerBard: 1, Bio: 1 },
                players: {
                    Sniper: new Array(),
                    Priest: new Array(),
                    Paladin: new Array(),
                    DancerBard: new Array(),
                    Bio: new Array(),
                    Bench: new Array(),
                    Absent: new Array()
                }
            };

            const embed = generateRaidEmbed(eventId);
            const components = generateRaidComponents(eventId);

            await interaction.reply({ embeds: new Array(embed), components: components });
        }
    }

    // 2. IF SOMEONE CLICKS A BUTTON OR DROPDOWN (Avoiding the problematic OR symbol)
    let isButton = interaction.isButton();
    let isMenu = interaction.isStringSelectMenu();

    if (isButton) {
        await processClick(interaction, true);
    } else if (isMenu) {
        await processClick(interaction, false);
    }
});

// THE LOGIC THAT ADDS THE NAME TO THE BOX
async function processClick(interaction, isButton) {
    const parts = interaction.customId.split('_');
    let eventId;
    let choice;

    if (isButton) {
        eventId = parts[1];
        choice = parts[2];
    } else {
        eventId = parts[2];
        choice = interaction.values.at(0);
    }

    const event = raidData[eventId];

    if (!event) {
        return interaction.reply({ content: "❌ This event expired.", ephemeral: true });
    }

    if (choice === 'Late') {
        return interaction.reply({ content: "⏱️ Your status has been noted as: Late!", ephemeral: true });
    } else if (choice === 'RemoveLate') {
        return interaction.reply({ content: "⏱️ Your status has been noted as: RemoveLate!", ephemeral: true });
    }

    const userName = interaction.user.username;

    // Remove user from all other roles first to prevent double sign-ups
    for (const key in event.players) {
        event.players[key] = event.players[key].filter(name => name!== userName);
    }

    // Check limits
    if (event.limits[choice]) {
        if (event.players[choice].length >= event.limits[choice]) {
            return interaction.reply({ content: `❌ The **${choice}** role is already full!`, ephemeral: true });
        }
    }

    // Add them to the new role
    event.players[choice].push(userName);

    // Re-draw the box and instantly update the message
    const updatedEmbed = generateRaidEmbed(eventId);
    await interaction.update({ embeds: new Array(updatedEmbed) });
}

// HELPER FUNCTION: DRAWS THE COLORED BOX
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

// HELPER FUNCTION: DRAWS THE BUTTONS & DROPDOWN
function generateRaidComponents(eventId) {
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`role_Sniper_${eventId}`).setLabel('Sniper').setEmoji('🎯').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`role_Priest_${eventId}`).setLabel('Priest').setEmoji('⛑️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`role_Paladin_${eventId}`).setLabel('Paladin').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`role_DancerBard_${eventId}`).setLabel('DancerBard').setEmoji('🎸').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`role_Bio_${eventId}`).setLabel('Bio').setEmoji('🧪').setStyle(ButtonStyle.Secondary)
    );

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

    return new Array(buttons, selectMenu);
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.log("LOGIN ERROR: Could not connect to Discord.");
    console.error(error);
});
