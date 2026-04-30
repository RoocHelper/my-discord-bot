const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const express = require('express');
const { JWT } = require('google-auth-library');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const chrono = require('chrono-node');

const app = express();
app.get('/', (req, res) => res.send('My bot is awake!'));

let port = process.env.PORT;
if (!port) {
    port = 3000;
}
app.listen(port, () => console.log('Web server started'));

const client = new Client({
    intents: new Array(
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    )
});

const raidData = {};

client.once('ready', async () => {
    console.log(`Success! Logged in as ${client.user.tag}`);
    
    // We added the /editraid command!
    await client.application.commands.set(new Array(
        {
            name: 'raid',
            description: 'Create a Raid-Helper style event!',
            options: new Array(
                { name: 'title', description: 'What is the name of the raid?', type: 3, required: true },
                { name: 'date', description: 'When? (e.g., tomorrow at 9pm, next friday)', type: 3, required: true }
            )
        },
        {
            name: 'editraid',
            description: 'Edit the time of an existing raid',
            options: new Array(
                { name: 'event_id', description: 'The ID at the bottom of the raid box', type: 3, required: true },
                { name: 'new_date', description: 'The new time (e.g., in 2 hours)', type: 3, required: true }
            )
        }
    ));
    console.log('Commands created!');
});

client.on('interactionCreate', async (interaction) => {
    
    // 1. IF SOMEONE TYPES A COMMAND
    if (interaction.isChatInputCommand()) {
        
        // --- CREATE RAID COMMAND ---
        if (interaction.commandName === 'raid') {
            const eventId = Date.now().toString();
            const customTitle = interaction.options.getString('title');
            const customDateString = interaction.options.getString('date');
            
            // SMART PARSING: Chrono figures out natural language dates
            const parsedDate = chrono.parseDate(customDateString);
            if (!parsedDate) {
                return interaction.reply({ content: '❌ I could not understand that date format. Try "tomorrow at 9pm".', ephemeral: true });
            }
            const unixTime = Math.floor(parsedDate.getTime() / 1000);

            raidData[eventId] = {
                title: customTitle,
                time: unixTime,
                messageId: null,
                channelId: null,
                limits: { Sniper: 5, Priest: 2, Paladin: 1, DancerBard: 1, Bio: 1 },
                players: {
                    Sniper: new Array(), Priest: new Array(), Paladin: new Array(),
                    DancerBard: new Array(), Bio: new Array(), Bench: new Array(), Absent: new Array()
                }
            };

            const embed = generateRaidEmbed(eventId);
            const components = generateRaidComponents(eventId);

            // Send the message and save its ID so we can edit it later!
            const reply = await interaction.reply({ embeds: new Array(embed), components: components, fetchReply: true });
            raidData[eventId].messageId = reply.id;
            raidData[eventId].channelId = reply.channelId;
        }

        // --- EDIT RAID COMMAND ---
        if (interaction.commandName === 'editraid') {
            const eventId = interaction.options.getString('event_id');
            const newDateString = interaction.options.getString('new_date');
            const event = raidData[eventId];

            if (!event) {
                return interaction.reply({ content: '❌ Event not found or expired.', ephemeral: true });
            }

            const parsedDate = chrono.parseDate(newDateString);
            if (!parsedDate) {
                return interaction.reply({ content: '❌ I could not understand that date format.', ephemeral: true });
            }

            // Update the time in memory
            event.time = Math.floor(parsedDate.getTime() / 1000);

            // Fetch the original message from the channel and edit the box!
            const channel = await client.channels.fetch(event.channelId);
            const message = await channel.messages.fetch(event.messageId);
            const updatedEmbed = generateRaidEmbed(eventId);
            
            await message.edit({ embeds: new Array(updatedEmbed) });
            return interaction.reply({ content: `✅ Event time successfully updated!`, ephemeral: true });
        }
    }

    // 2. IF SOMEONE CLICKS A BUTTON OR DROPDOWN
    let isButton = interaction.isButton();
    let isMenu = interaction.isStringSelectMenu();

    if (isButton) {
        await processClick(interaction, true);
    } else if (isMenu) {
        await processClick(interaction, false);
    }
});

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

    for (const key in event.players) {
        event.players[key] = event.players[key].filter(name => name!== userName);
    }

    if (event.limits[choice]) {
        if (event.players[choice].length >= event.limits[choice]) {
            return interaction.reply({ content: `❌ The **${choice}** role is already full!`, ephemeral: true });
        }
    }

    event.players[choice].push(userName);

    const updatedEmbed = generateRaidEmbed(eventId);
    await interaction.update({ embeds: new Array(updatedEmbed) });

    // After updating Discord, backup the sign up to Google Sheets!
    await backupToGoogleSheets(eventId, userName, choice);
}

// --- GOOGLE SHEETS BACKUP ENGINE ---
async function backupToGoogleSheets(eventId, username, role) {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY;
    const sheetId = process.env.GOOGLE_SHEET_ID;

    // If you haven't set up the keys yet, safely skip so the bot doesn't crash
    if (!email) return;
    if (!key) return;
    if (!sheetId) return;

    try {
        const serviceAccountAuth = new JWT({
            email: email,
            key: key.replace(/\\n/g, '\n'), // Fixes Render formatting issues with private keys
            scopes: new Array('https://www.googleapis.com/auth/spreadsheets'),
        });
        
        const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex.at(0); 
        
        // Write the data to a new row
        await sheet.addRow({ EventID: eventId, User: username, Role: role, Time: new Date().toLocaleString() });
        console.log(`Saved ${username} to Google Sheets!`);
    } catch (error) {
        console.log("Google Sheets Error:", error);
    }
}

// HELPER FUNCTION: DRAWS THE COLORED BOX
function generateRaidEmbed(eventId) {
    const event = raidData[eventId];
    const formatList = (list) => list.length > 0? list.join('\n') : '-';

    const timeDisplay = `<t:${event.time}:d>`;
    const exactTime = `<t:${event.time}:t>`;
    const relativeTime = `<t:${event.time}:R>`;

    // Matches the exact calculations from your image
    const roleTotal = event.players.Sniper.length + event.players.Priest.length + event.players.Paladin.length + event.players.DancerBard.length + event.players.Bio.length;
    const statusTotal = event.players.Bench.length + event.players.Absent.length;
    const grandTotal = roleTotal + statusTotal;

    return new EmbedBuilder()
   .setTitle(event.title)
   .setColor('#F1C40F')
   .setDescription(`**Event Info:**\n📅 ${timeDisplay}\n🕒 ${exactTime} - None\n\n`)
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
   .setFooter({ text: `Sign ups: Total: ${grandTotal} - Role: ${roleTotal} - Status: ${statusTotal}\nEvent ID: ${eventId}\nEvent start time • ${relativeTime}` });
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
