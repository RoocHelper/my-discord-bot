const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
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
    
    if (interaction.isChatInputCommand()) {
        
        // --- CREATE RAID COMMAND ---
        if (interaction.commandName === 'raid') {
            // We tell Discord to wait a moment while we check Google Sheets for the next ID
            await interaction.deferReply(); 

            let eventId = "1"; // Default starting ID
            const customTitle = interaction.options.getString('title');
            const customDateString = interaction.options.getString('date');
            
            const parsedDate = chrono.parseDate(customDateString);
            if (!parsedDate) {
                return interaction.editReply({ content: '❌ I could not understand that date format. Try "tomorrow at 9pm".' });
            }
            const unixTime = Math.floor(parsedDate.getTime() / 1000);

            // AUTO-INCREMENT ID LOGIC: Check Google Sheets for the highest number
            try {
                const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
                const key = process.env.GOOGLE_PRIVATE_KEY;
                const sheetId = process.env.GOOGLE_SHEET_ID;

                if (email) {
                    if (key) {
                        if (sheetId) {
                            const serviceAccountAuth = new JWT({
                                email: email,
                                key: key.replace(/\\n/g, '\n'),
                                scopes: new Array('https://www.googleapis.com/auth/spreadsheets'),
                            });
                            const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
                            await doc.loadInfo();
                            const sheet = doc.sheetsByIndex.at(0);
                            const rows = await sheet.getRows();

                            let lastId = 0;
                            if (rows.length > 0) {
                                // Find the highest ID number currently in the sheet
                                for (let i = 0; i < rows.length; i++) {
                                    let rowId = parseInt(String(rows.at(i).get('EventID')).replace("'", ""));
                                    if (rowId > lastId) {
                                        lastId = rowId;
                                    }
                                }
                            }
                            // Add 1 to the highest number we found
                            let nextIdNum = lastId + 1;
                            eventId = nextIdNum.toString();
                        }
                    }
                }
            } catch (error) {
                console.log("Could not fetch ID, defaulting to timestamp.", error);
                eventId = Date.now().toString(); 
            }

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

            // Post the final raid box
            const reply = await interaction.editReply({ embeds: new Array(embed), components: components });
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

            event.time = Math.floor(parsedDate.getTime() / 1000);

            const channel = await client.channels.fetch(event.channelId);
            const message = await channel.messages.fetch(event.messageId);
            const updatedEmbed = generateRaidEmbed(eventId);
            
            await message.edit({ embeds: new Array(updatedEmbed) });
            return interaction.reply({ content: `✅ Event time successfully updated!`, ephemeral: true });
        }
    }

    // --- 2. IF SOMEONE CLICKS A BUTTON OR DROPDOWN ---
    let isButton = interaction.isButton();
    let isMenu = interaction.isStringSelectMenu();

    if (isButton) {
        await processClick(interaction, true);
    } else if (isMenu) {
        await processClick(interaction, false);
    }
});

async function processClick(interaction, isButton) {
    try {
        await interaction.deferUpdate();

        const parts = interaction.customId.split('_');
        let action = parts.at(0);
        let eventId;
        let choice;

        if (action === 'status') {
            eventId = parts.at(1);
            choice = interaction.values.at(0);
        } else {
            choice = parts.at(1);
            eventId = parts.at(2);
        }

        // CLOSE EVENT LOGIC
        if (action === 'admin') {
            if (choice === 'close') {
                let hasPerms = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
                if (!hasPerms) {
                    return interaction.followUp({ content: "❌ You don't have permission to close this event.", ephemeral: true });
                }

                const receivedEmbed = interaction.message.embeds.at(0);
                const closedEmbed = EmbedBuilder.from(receivedEmbed)
                  .setTitle(` ${receivedEmbed.title}`)
                  .setColor('#E74C3C');

                await interaction.editReply({ embeds: new Array(closedEmbed), components: new Array() });
                return interaction.followUp({ content: "✅ Event closed successfully! No one else can sign up.", ephemeral: true });
            }
        }

        const lateStatuses = new Array('Late', 'RemoveLate');
        if (lateStatuses.includes(choice)) {
            return interaction.followUp({ content: "⏱️ Your status has been noted!", ephemeral: true });
        }

        const receivedEmbed = interaction.message.embeds.at(0);
        const fields = receivedEmbed.fields;

        const parseField = (index) => {
            const value = fields.at(index).value;
            if (value === '-') {
                return new Array();
            }
            return value.split('\n');
        };

        const event = {
            title: receivedEmbed.title,
            limits: { Sniper: 5, Priest: 2, Paladin: 1, DancerBard: 1, Bio: 1 },
            players: {
                Sniper: parseField(0),
                Priest: parseField(1),
                Paladin: parseField(2),
                DancerBard: parseField(3),
                Bio: parseField(4),
                Bench: parseField(6),
                Absent: parseField(7)
            }
        };

        const userName = interaction.user.username;

        // Remove user from all lists
        for (const key in event.players) {
            event.players[key] = event.players[key].filter(name => name!== userName);
        }

        if (event.limits[choice]) {
            if (event.players[choice].length >= event.limits[choice]) {
                return interaction.followUp({ content: `❌ The **${choice}** role is already full!`, ephemeral: true });
            }
        }

        event.players[choice].push(userName);

        const roleTotal = event.players.Sniper.length + event.players.Priest.length + event.players.Paladin.length + event.players.DancerBard.length + event.players.Bio.length;
        const statusTotal = event.players.Bench.length + event.players.Absent.length;
        const grandTotal = roleTotal + statusTotal;

        const oldFooter = receivedEmbed.footer.text;
        const timeLine = oldFooter.split('\n').at(2); 

        const formatList = (list) => list.length > 0? list.join('\n') : '-';
        
        const newEmbed = new EmbedBuilder()
          .setTitle(event.title)
          .setColor('#F1C40F')
          .setDescription(receivedEmbed.description)
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
          .setFooter({ text: `Sign ups: Total: ${grandTotal} - Role: ${roleTotal} - Status: ${statusTotal}\nEvent ID: ${eventId}\n${timeLine}` });

        await interaction.editReply({ embeds: new Array(newEmbed) });

        // Pass the Title into the Google Sheets backup!
        await backupToGoogleSheets(`'${eventId}`, event.title, userName, choice); 

    } catch (error) {
        console.log("CLICK ERROR:", error);
        await interaction.followUp({ content: `❌ Error caught: ${error.message}`, ephemeral: true });
    }
}

// --- GOOGLE SHEETS BACKUP ENGINE ---
async function backupToGoogleSheets(eventId, eventTitle, username, role) {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY;
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!email) return;
    if (!key) return;
    if (!sheetId) return;

    try {
        const serviceAccountAuth = new JWT({
            email: email,
            key: key.replace(/\\n/g, '\n'),
            scopes: new Array('https://www.googleapis.com/auth/spreadsheets'),
        });
        
        const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex.at(0); 
        
        const rows = await sheet.getRows();
        const safeEventId = String(eventId).replace("'", "");
        const existingRow = rows.find(r => String(r.get('EventID')).replace("'", "") === safeEventId && r.get('User') === username);

        if (existingRow) {
            existingRow.set('Role', role);
            existingRow.set('Title', eventTitle); // Updates the Title column!
            existingRow.set('Time', new Date().toLocaleString());
            await existingRow.save(); 
        } else {
            // Adds the Title column on the first sign up!
            await sheet.addRow({ EventID: eventId, Title: eventTitle, User: username, Role: role, Time: new Date().toLocaleString() });
        }
        
    } catch (error) {
        console.log("Google Sheets Error:", error);
    }
}

function generateRaidEmbed(eventId) {
    const event = raidData[eventId];
    const formatList = (list) => list.length > 0? list.join('\n') : '-';

    const timeDisplay = `<t:${event.time}:d>`;
    const exactTime = `<t:${event.time}:t>`;
    const relativeTime = `<t:${event.time}:R>`;

    return new EmbedBuilder()
      .setTitle(event.title)
      .setColor('#F1C40F')
      .setDescription(`**Event Info:**\n📅 ${timeDisplay}\n🕒 ${exactTime} - None\n\n`)
      .addFields(
            { name: `🎯 Sniper (0/${event.limits.Sniper})`, value: '-', inline: true },
            { name: `⛑️ Priest (0/${event.limits.Priest})`, value: '-', inline: true },
            { name: `🛡️ Paladin (0/${event.limits.Paladin})`, value: '-', inline: true },
            { name: `🎸 DancerBard (0/${event.limits.DancerBard})`, value: '-', inline: true },
            { name: `🧪 Bio (0/${event.limits.Bio})`, value: '-', inline: true },
            { name: '\u200b', value: '----------------------------------------', inline: false },
            { name: `🪑 Bench (0)`, value: '-', inline: true },
            { name: `🅰️ Absent (0)`, value: '-', inline: true }
        )
      .setFooter({ text: `Sign ups: Total: 0 - Role: 0 - Status: 0\nEvent ID: ${eventId}\nEvent start time • ${relativeTime}` });
}

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

    const adminControls = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`admin_close_${eventId}`).setLabel('Close Event').setEmoji('🔒').setStyle(ButtonStyle.Danger)
    );

    return new Array(buttons, selectMenu, adminControls);
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.log("LOGIN ERROR: Could not connect to Discord.");
    console.error(error);
});
