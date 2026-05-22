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
const paginationData = {}; 

// --- KONFIGURASI 13 PROFESI ---
const JOBS = new Array(
    { id: 'LK', label: 'LK', customId: '⚔️', emoji: '⚔️' },
    { id: 'BardDancer', label: 'Bard/Dancer', customId: '1498698562010353704', emoji: '<:DancerBard:1498698562010353704>' },
    { id: 'Sniper', label: 'Sniper', customId: '1498698005539459122', emoji: '<:Sniper:1498698005539459122>' },
    { id: 'BioChemist', label: 'Bio Chemist', customId: '1498698315254988891', emoji: '<:Bio:1498698315254988891>' },
    { id: 'Mastersmith', label: 'Mastersmith', customId: '🔨', emoji: '🔨' },
    { id: 'Assassin', label: 'Assassin', customId: '🗡️', emoji: '🗡️' },
    { id: 'Professor', label: 'Professor', customId: '📚', emoji: '📚' },
    { id: 'HighWizard', label: 'High Wizard', customId: '🔮', emoji: '🔮' },
    { id: 'Champion', label: 'Champion', customId: '🥊', emoji: '🥊' },
    { id: 'HighPriest', label: 'High Priest', customId: '1498698148065841294', emoji: '<:Priest:1498698148065841294>' },
    { id: 'Paladin', label: 'Paladin', customId: '1498698119913672736', emoji: '<:Paladin:1498698119913672736>' },
    { id: 'DoramPhys', label: 'Doram Phys', customId: '🐱', emoji: '🐱' },
    { id: 'DoramMagic', label: 'Doram Magic', customId: '🪄', emoji: '🪄' }
);

function safeGetInteger(interaction, name) {
    let value = interaction.options.getInteger(name);
    if (value === null) {
        return 0;
    }
    return value;
}

client.once('ready', async () => {
    console.log(`Success! Logged in as ${client.user.tag}`);
    
    await client.application.commands.set(new Array(
        {
            name: 'cekbid',
            description: 'Cek daftar kemenangan bid personal di tab GL Omni Ruler!'
        },
        {
            name: 'cekbidall',
            description: 'Tampilkan seluruh bid list di tab GL Omni Ruler menggunakan halaman!'
        },
        {
            name: 'cekprize',
            description: 'Cek daftar kemenangan bid personal di tab League Prize!'
        },
        {
            name: 'cekprizeall',
            description: 'Tampilkan seluruh bid list di tab League Prize menggunakan halaman!'
        },
        {
            name: 'editraid',
            description: 'Edit the time of an existing event',
            options: new Array(
                { name: 'event_id', description: 'The ID at the bottom of the box', type: 3, required: true },
                { name: 'new_date', description: 'The new time (e.g., in 2 hours)', type: 3, required: true }
            )
        },
        {
            name: 'absen',
            description: 'Buat form absensi (Isi kuota max per class, kosongkan jika tidak dipakai)',
            options: new Array(
                { name: 'title', description: 'Judul absen?', type: 3, required: true },
                { name: 'date', description: 'Kapan? (e.g., tomorrow at 9pm)', type: 3, required: true },
                { name: 'lk', description: 'Max Lord Knight (Otomatis 0)', type: 4, required: false },
                { name: 'bard_dancer', description: 'Max Bard/Dancer (Otomatis 0)', type: 4, required: false },
                { name: 'sniper', description: 'Max Sniper (Otomatis 0)', type: 4, required: false },
                { name: 'bio_chemist', description: 'Max Bio Chemist (Otomatis 0)', type: 4, required: false },
                { name: 'mastersmith', description: 'Max Mastersmith (Otomatis 0)', type: 4, required: false },
                { name: 'assassin', description: 'Max Assassin (Otomatis 0)', type: 4, required: false },
                { name: 'professor', description: 'Max Professor (Otomatis 0)', type: 4, required: false },
                { name: 'high_wizard', description: 'Max High Wizard (Otomatis 0)', type: 4, required: false },
                { name: 'champion', description: 'Max Champion (Otomatis 0)', type: 4, required: false },
                { name: 'high_priest', description: 'Max High Priest (Otomatis 0)', type: 4, required: false },
                { name: 'paladin', description: 'Max Paladin (Otomatis 0)', type: 4, required: false },
                { name: 'doram_phys', description: 'Max Doram Phys (Otomatis 0)', type: 4, required: false },
                { name: 'doram_magic', description: 'Max Doram Magic (Otomatis 0)', type: 4, required: false }
            )
        }
    ));
    console.log('Commands created!');
});

client.on('interactionCreate', async (interaction) => {
    
    if (interaction.isChatInputCommand()) {

        // ==========================================
        // COMMAND: /CEKPRIZE (League Prize - Personal)
        // ==========================================
        if (interaction.commandName === 'cekprize') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
                const key = process.env.GOOGLE_PRIVATE_KEY;
                const sheetId = process.env.GOOGLE_SHEET_ID;

                let isConfigured = false;
                if (email && key && sheetId) isConfigured = true;

                if (!isConfigured) return interaction.editReply({ content: '❌ Konfigurasi Sheets belum lengkap.' });

                const serviceAccountAuth = new JWT({
                    email: email,
                    key: key.replace(/\\n/g, '\n'),
                    scopes: new Array('https://www.googleapis.com/auth/spreadsheets'),
                });
                const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
                await doc.loadInfo();
                
                // Mengambil Tab ke-3 ("League Prize" berada di Indeks 2)
                const sheet = doc.sheetsByIndex.at(2);
                if (!sheet) return interaction.editReply({ content: '❌ Tab Sheet ke-3 (League Prize) tidak ditemukan!' });
                
                const rows = await sheet.getRows();
                const userName = interaction.member.displayName.toLowerCase();

                const results = rows.filter(row => {
                    let player = row.get('Player yang Bid');
                    if (!player) { if (row._rawData) player = row._rawData.at(3); }
                    if (player) return player.toLowerCase() === userName;
                    return false;
                });

                if (results.length === 0) {
                    return interaction.editReply({ content: `❌ Halo **${interaction.member.displayName}**, nama kamu **tidak ada** di bid League Prize saat ini.` });
                }

                let descriptionText = `Halo **${interaction.member.displayName}**, ini adalah daftar kemenangan League Prize kamu:\n\n`;
                results.forEach(res => {
                    let page = res.get('Halaman')? res.get('Halaman') : (res._rawData? res._rawData.at(0) : '-');
                    let slot = res.get('Slot')? res.get('Slot') : (res._rawData? res._rawData.at(1) : '-');
                    let item = res.get('Nama Item (Otomatis)')? res.get('Nama Item (Otomatis)') : (res._rawData? res._rawData.at(2) : 'Item');
                    descriptionText += `💎 **${item}** (Halaman: ${page}, Slot: ${slot})\n`;
                });

                const resultEmbed = new EmbedBuilder()
                 .setTitle('🏆 League Prize Personal')
                 .setColor('#FFD700')
                 .setDescription(descriptionText)
                 .setFooter({ text: `Total item dimenangkan: ${results.length}` });

                return interaction.editReply({ embeds: new Array(resultEmbed) });
            } catch (error) {
                console.log("CEKPRIZE ERROR:", error);
                return interaction.editReply({ content: `❌ Terjadi kesalahan: ${error.message}` });
            }
        }

        // ==========================================
        // COMMAND: /CEKPRIZEALL (League Prize - All)
        // ==========================================
        if (interaction.commandName === 'cekprizeall') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
                const key = process.env.GOOGLE_PRIVATE_KEY;
                const sheetId = process.env.GOOGLE_SHEET_ID;

                let isConfigured = false;
                if (email && key && sheetId) isConfigured = true;

                if (!isConfigured) return interaction.editReply({ content: '❌ Konfigurasi Sheets belum lengkap.' });

                const serviceAccountAuth = new JWT({
                    email: email,
                    key: key.replace(/\\n/g, '\n'),
                    scopes: new Array('https://www.googleapis.com/auth/spreadsheets'),
                });
                const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
                await doc.loadInfo();
                
                const sheet = doc.sheetsByIndex.at(2);
                if (!sheet) return interaction.editReply({ content: '❌ Tab Sheet ke-3 (League Prize) tidak ditemukan!' });
                
                const rows = await sheet.getRows();

                if (rows.length === 0) return interaction.editReply({ content: '❌ Data di Google Sheets (Tab 3) masih kosong.' });

                const allItems = new Array();
                rows.forEach(res => {
                    let page = res.get('Halaman')? res.get('Halaman') : (res._rawData? res._rawData.at(0) : '-');
                    let slot = res.get('Slot')? res.get('Slot') : (res._rawData? res._rawData.at(1) : '-');
                    let item = res.get('Nama Item (Otomatis)')? res.get('Nama Item (Otomatis)') : (res._rawData? res._rawData.at(2) : 'Item');
                    let bidder = res.get('Player yang Bid')? res.get('Player yang Bid') : (res._rawData? res._rawData.at(3) : '-');
                    
                    allItems.push(`Hal: **${page}** | Slot: **${slot}** | 💎 **${item}** — 👤 ${bidder}`);
                });

                const pages = new Array();
                const itemsPerPage = 15;
                for (let i = 0; i < allItems.length; i += itemsPerPage) {
                    let chunk = allItems.slice(i, i + itemsPerPage);
                    pages.push(chunk.join('\n'));
                }

                const pageId = Date.now().toString();
                paginationData[pageId] = {
                    pages: pages,
                    currentPage: 0,
                    userId: interaction.user.id,
                    totalItems: allItems.length,
                    title: '🏆 Seluruh Informasi League Prize',
                    color: '#FFD700'
                };

                const embed = new EmbedBuilder()
                .setTitle(paginationData[pageId].title)
                .setColor(paginationData[pageId].color)
                .setDescription(pages.at(0))
                .setFooter({ text: `Halaman 1 dari ${pages.length} | Total Data: ${allItems.length}` });

                const buttons = generatePaginationButtons(pageId, 0, pages.length);

                return interaction.editReply({ embeds: new Array(embed), components: new Array(buttons) });
            } catch (error) {
                console.log("CEKPRIZEALL ERROR:", error);
                return interaction.editReply({ content: `❌ Terjadi kesalahan: ${error.message}` });
            }
        }
        
        // ==========================================
        // COMMAND: /CEKBIDALL (GL Omni - All)
        // ==========================================
        if (interaction.commandName === 'cekbidall') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
                const key = process.env.GOOGLE_PRIVATE_KEY;
                const sheetId = process.env.GOOGLE_SHEET_ID;

                let isConfigured = false;
                if (email && key && sheetId) isConfigured = true;

                if (!isConfigured) return interaction.editReply({ content: '❌ Konfigurasi Sheets belum lengkap.' });

                const serviceAccountAuth = new JWT({
                    email: email,
                    key: key.replace(/\\n/g, '\n'),
                    scopes: new Array('https://www.googleapis.com/auth/spreadsheets'),
                });
                const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
                await doc.loadInfo();
                
                const sheet = doc.sheetsByIndex.at(1);
                const rows = await sheet.getRows();

                if (rows.length === 0) return interaction.editReply({ content: '❌ Data bid di Google Sheets masih kosong.' });

                const allItems = new Array();
                rows.forEach(res => {
                    let player = res.get('Player yang Bid')? res.get('Player yang Bid') : '-';
                    let item = res.get('Nama Item (Otomatis)')? res.get('Nama Item (Otomatis)') : 'Item';
                    let page = res.get('Halaman')? res.get('Halaman') : '-';
                    let slot = res.get('Slot')? res.get('Slot') : '-';
                    
                    allItems.push(`Hal: **${page}** | Slot: **${slot}** | 📦 **${item}** — 👤 ${player}`);
                });

                const pages = new Array();
                const itemsPerPage = 15;
                for (let i = 0; i < allItems.length; i += itemsPerPage) {
                    let chunk = allItems.slice(i, i + itemsPerPage);
                    pages.push(chunk.join('\n'));
                }

                const pageId = Date.now().toString();
                paginationData[pageId] = {
                    pages: pages,
                    currentPage: 0,
                    userId: interaction.user.id,
                    totalItems: allItems.length,
                    title: '📋 Seluruh Informasi Bid Listing',
                    color: '#3498DB'
                };

                const embed = new EmbedBuilder()
               .setTitle(paginationData[pageId].title)
               .setColor(paginationData[pageId].color)
               .setDescription(pages.at(0))
               .setFooter({ text: `Halaman 1 dari ${pages.length} | Total Data: ${allItems.length}` });

                const buttons = generatePaginationButtons(pageId, 0, pages.length);

                return interaction.editReply({ embeds: new Array(embed), components: new Array(buttons) });
            } catch (error) {
                return interaction.editReply({ content: `❌ Terjadi kesalahan: ${error.message}` });
            }
        }

        // ==========================================
        // COMMAND: /CEKBID (GL Omni - Personal)
        // ==========================================
        if (interaction.commandName === 'cekbid') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
                const key = process.env.GOOGLE_PRIVATE_KEY;
                const sheetId = process.env.GOOGLE_SHEET_ID;

                let isConfigured = false;
                if (email && key && sheetId) isConfigured = true;

                if (!isConfigured) return interaction.editReply({ content: '❌ Konfigurasi Sheets belum lengkap.' });

                const serviceAccountAuth = new JWT({
                    email: email,
                    key: key.replace(/\\n/g, '\n'),
                    scopes: new Array('https://www.googleapis.com/auth/spreadsheets'),
                });
                const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
                await doc.loadInfo();
                const sheet = doc.sheetsByIndex.at(1);
                const rows = await sheet.getRows();
                const userName = interaction.member.displayName.toLowerCase();

                const results = rows.filter(row => {
                    const player = row.get('Player yang Bid');
                    if (player) return player.toLowerCase() === userName;
                    return false;
                });

                if (results.length === 0) {
                    return interaction.editReply({ content: `❌ Halo **${interaction.member.displayName}**, nama kamu **tidak ada** di bid listing saat ini.` });
                }

                let descriptionText = `Halo **${interaction.member.displayName}**, ini adalah daftar bid yang kamu menangkan:\n\n`;
                results.forEach(res => {
                    let item = res.get('Nama Item (Otomatis)')? res.get('Nama Item (Otomatis)') : 'Item';
                    let page = res.get('Halaman')? res.get('Halaman') : '-';
                    let slot = res.get('Slot')? res.get('Slot') : '-';
                    descriptionText += `📦 **${item}** (Halaman: ${page}, Slot: ${slot})\n`;
                });

                const resultEmbed = new EmbedBuilder()
           .setTitle('📋 Informasi Bid Listing')
           .setColor('#2ECC71')
           .setDescription(descriptionText)
           .setFooter({ text: `Total item dimenangkan: ${results.length}` });

                return interaction.editReply({ embeds: new Array(resultEmbed) });
            } catch (error) {
                return interaction.editReply({ content: `❌ Terjadi kesalahan: ${error.message}` });
            }
        }

        // ==========================================
        // COMMAND: /ABSEN
        // ==========================================
        if (interaction.commandName === 'absen') {
            await interaction.deferReply(); 

            let eventId = "1";
            const customTitle = interaction.options.getString('title');
            const customDateString = interaction.options.getString('date');
            
            const parsedDate = chrono.parseDate(customDateString);
            if (!parsedDate) {
                return interaction.editReply({ content: '❌ I could not understand that date format. Try "tomorrow at 9pm".' });
            }
            const unixTime = Math.floor(parsedDate.getTime() / 1000);

            try {
                const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
                const key = process.env.GOOGLE_PRIVATE_KEY;
                const sheetId = process.env.GOOGLE_SHEET_ID;

                let isConfigured = false;
                if (email && key && sheetId) isConfigured = true;

                if (isConfigured) {
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
                        for (let i = 0; i < rows.length; i++) {
                            let rowId = parseInt(String(rows.at(i).get('EventID')).replace("'", ""));
                            if (rowId > lastId) lastId = rowId;
                        }
                    }
                    eventId = (lastId + 1).toString();
                }
            } catch (error) {
                eventId = Date.now().toString(); 
            }

            const limits = {
                LK: safeGetInteger(interaction, 'lk'),
                BardDancer: safeGetInteger(interaction, 'bard_dancer'),
                Sniper: safeGetInteger(interaction, 'sniper'),
                BioChemist: safeGetInteger(interaction, 'bio_chemist'),
                Mastersmith: safeGetInteger(interaction, 'mastersmith'),
                Assassin: safeGetInteger(interaction, 'assassin'),
                Professor: safeGetInteger(interaction, 'professor'),
                HighWizard: safeGetInteger(interaction, 'high_wizard'),
                Champion: safeGetInteger(interaction, 'champion'),
                HighPriest: safeGetInteger(interaction, 'high_priest'),
                Paladin: safeGetInteger(interaction, 'paladin'),
                DoramPhys: safeGetInteger(interaction, 'doram_phys'),
                DoramMagic: safeGetInteger(interaction, 'doram_magic')
            };

            const event = {
                title: customTitle,
                time: unixTime,
                limits: limits,
                players: {
                    LK: new Array(), BardDancer: new Array(), Sniper: new Array(), BioChemist: new Array(),
                    Mastersmith: new Array(), Assassin: new Array(), Professor: new Array(), HighWizard: new Array(),
                    Champion: new Array(), HighPriest: new Array(), Paladin: new Array(), DoramPhys: new Array(), 
                    DoramMagic: new Array(), Bench: new Array(), Absent: new Array()
                }
            };

            const timeDisplay = `<t:${unixTime}:d>`;
            const exactTime = `<t:${unixTime}:t>`;
            const relativeTime = `<t:${unixTime}:R>`;
            const description = `**Event Info:**\n📅 ${timeDisplay}\n🕒 ${exactTime} - None\n\n`;
            const timeLine = `Event start time • ${relativeTime}`;

            const embed = generateDynamicEmbed(eventId, event, description, timeLine);
            const components = generateDynamicComponents(eventId, event);

            const reply = await interaction.editReply({ embeds: new Array(embed), components: components });
            
            raidData[eventId] = { messageId: reply.id, channelId: reply.channelId, time: unixTime };
        }

        // ==========================================
        // COMMAND: /EDITRAID
        // ==========================================
        if (interaction.commandName === 'editraid') {
            const eventId = interaction.options.getString('event_id');
            const newDateString = interaction.options.getString('new_date');
            const eventMem = raidData[eventId];

            if (!eventMem) return interaction.reply({ content: '❌ Event not found or expired.', ephemeral: true });

            const parsedDate = chrono.parseDate(newDateString);
            if (!parsedDate) return interaction.reply({ content: '❌ I could not understand that date format.', ephemeral: true });
            
            eventMem.time = Math.floor(parsedDate.getTime() / 1000);

            const channel = await client.channels.fetch(eventMem.channelId);
            const message = await channel.messages.fetch(eventMem.messageId);
            
            const receivedEmbed = message.embeds.at(0);
            const timeDisplay = `<t:${eventMem.time}:d>`;
            const exactTime = `<t:${eventMem.time}:t>`;
            const relativeTime = `<t:${eventMem.time}:R>`;
            const newDescription = `**Event Info:**\n📅 ${timeDisplay}\n🕒 ${exactTime} - None\n\n`;
            const timeLine = `Event start time • ${relativeTime}`;
            
            const event = extractEventFromEmbed(receivedEmbed);
            
            const updatedEmbed = generateDynamicEmbed(eventId, event, newDescription, timeLine);
            await message.edit({ embeds: new Array(updatedEmbed) });
            return interaction.reply({ content: `✅ Event time successfully updated!`, ephemeral: true });
        }
    }

    let isButton = interaction.isButton();
    let isMenu = interaction.isStringSelectMenu();

    if (isButton) {
        await processClick(interaction, true);
    } else if (isMenu) {
        await processClick(interaction, false);
    }
});

// ==========================================
// MAGIC CLICK HANDLER
// ==========================================
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

        // --- PAGINATION GLOBAL ---
        if (action === 'page') {
            let direction = choice; 
            let pageId = eventId; 
            let pageData = paginationData[pageId];

            if (!pageData) {
                return interaction.followUp({ content: '❌ Sesi halaman ini sudah kedaluwarsa.', ephemeral: true });
            }

            if (interaction.user.id!== pageData.userId) {
                return interaction.followUp({ content: '❌ Hanya yang merequest command ini yang bisa membalik halaman.', ephemeral: true });
            }

            if (direction === 'prev') {
                if (pageData.currentPage > 0) pageData.currentPage--;
            } else if (direction === 'next') {
                let maxPage = pageData.pages.length - 1;
                if (pageData.currentPage < maxPage) pageData.currentPage++;
            }

            const embed = new EmbedBuilder()
            .setTitle(pageData.title)
            .setColor(pageData.color)
            .setDescription(pageData.pages.at(pageData.currentPage))
            .setFooter({ text: `Halaman ${pageData.currentPage + 1} dari ${pageData.pages.length} | Total Data: ${pageData.totalItems}` });

            const buttons = generatePaginationButtons(pageId, pageData.currentPage, pageData.pages.length);

            return interaction.editReply({ embeds: new Array(embed), components: new Array(buttons) });
        }

        if (action === 'admin') {
            if (choice === 'close') {
                let hasPerms = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
                if (!hasPerms) {
                    return interaction.followUp({ content: "❌ You don't have permission to close this event.", ephemeral: true });
                }
                const receivedEmbed = interaction.message.embeds.at(0);
                const closedEmbed = EmbedBuilder.from(receivedEmbed)
                .setTitle(`🔒 CLOSED - ${receivedEmbed.title}`)
                .setColor('#E74C3C');

                await interaction.editReply({ embeds: new Array(closedEmbed), components: new Array() });
                await backupToGoogleSheets(`'${eventId}`, receivedEmbed.title, '--- EVENT CLOSED ---', '---', '---');
                return interaction.followUp({ content: "✅ Event closed successfully! No one else can sign up.", ephemeral: true });
            }
        }

        const receivedEmbed = interaction.message.embeds.at(0);

        const lateStatuses = new Array('Late', 'RemoveLate');
        let isLateStatus = false;
        if (lateStatuses.includes(choice)) isLateStatus = true;

        if (isLateStatus) {
            await backupToGoogleSheets(`'${eventId}`, receivedEmbed.title, interaction.member.displayName, null, choice); 
            return interaction.followUp({ content: "⏱️ Your status has been noted in the spreadsheet!", ephemeral: true });
        }

        const event = extractEventFromEmbed(receivedEmbed);
        const userName = interaction.member.displayName;

        for (const key in event.players) {
            event.players[key] = event.players[key].filter(name => name!== userName);
        }

        if (event.limits[choice]) {
            if (event.players[choice].length >= event.limits[choice]) {
                return interaction.followUp({ content: `❌ Kuota untuk **${choice}** sudah penuh!`, ephemeral: true });
            }
        }

        event.players[choice].push(userName);

        const roleTotal = event.players.LK.length + event.players.BardDancer.length + event.players.Sniper.length + event.players.BioChemist.length + event.players.Mastersmith.length + event.players.Assassin.length + event.players.Professor.length + event.players.HighWizard.length + event.players.Champion.length + event.players.HighPriest.length + event.players.Paladin.length + event.players.DoramPhys.length + event.players.DoramMagic.length;
        const statusTotal = event.players.Bench.length + event.players.Absent.length;
        const grandTotal = roleTotal + statusTotal;

        const oldFooter = receivedEmbed.footer.text;
        const timeLine = oldFooter.split('\n').at(2); 

        const newEmbed = generateDynamicEmbed(eventId, event, receivedEmbed.description, timeLine);
        const newComponents = generateDynamicComponents(eventId, event); 

        await interaction.editReply({ embeds: new Array(newEmbed), components: newComponents });

        if (action === 'status') {
            await backupToGoogleSheets(`'${eventId}`, event.title, userName, null, choice); 
        } else {
            await backupToGoogleSheets(`'${eventId}`, event.title, userName, choice, null); 
        }

    } catch (error) {
        console.log("CLICK ERROR:", error);
        let isAlreadyReplied = false;
        if (interaction.deferred) isAlreadyReplied = true;
        if (interaction.replied) isAlreadyReplied = true;

        if (isAlreadyReplied) {
            await interaction.followUp({ content: `❌ Error caught: ${error.message}`, ephemeral: true }).catch(console.error);
        } else {
            await interaction.reply({ content: `❌ Error caught: ${error.message}`, ephemeral: true }).catch(console.error);
        }
    }
}

// ==========================================
// FUNGSI PENDUKUNG EMBED DAN KOMPONEN
// ==========================================

function extractEventFromEmbed(receivedEmbed) {
    const fields = receivedEmbed.fields;

    const getFieldData = (label) => {
        const field = fields.find(f => f.name.includes(label));
        let isMissing = false;
        if (!field) {
            isMissing = true;
        } else if (field.value === '-') {
            isMissing = true;
        }

        if (isMissing) {
            return new Array();
        }
        return field.value.split('\n');
    };

    const getLimit = (label) => {
        const field = fields.find(f => f.name.includes(label));
        if (!field) return 0;
        const match = field.name.match(/\d+\/(\d+)\)/);
        if (match) {
            return parseInt(match[1]);
        }
        return 0;
    };

    return {
        title: receivedEmbed.title,
        limits: {
            LK: getLimit('LK'),
            BardDancer: getLimit('Bard/Dancer'),
            Sniper: getLimit('Sniper'),
            BioChemist: getLimit('Bio Chemist'),
            Mastersmith: getLimit('Mastersmith'),
            Assassin: getLimit('Assassin'),
            Professor: getLimit('Professor'),
            HighWizard: getLimit('High Wizard'),
            Champion: getLimit('Champion'),
            HighPriest: getLimit('High Priest'),
            Paladin: getLimit('Paladin'),
            DoramPhys: getLimit('Doram Phys'),
            DoramMagic: getLimit('Doram Magic')
        },
        players: {
            LK: getFieldData('LK'),
            BardDancer: getFieldData('Bard/Dancer'),
            Sniper: getFieldData('Sniper'),
            BioChemist: getFieldData('Bio Chemist'),
            Mastersmith: getFieldData('Mastersmith'),
            Assassin: getFieldData('Assassin'),
            Professor: getFieldData('Professor'),
            HighWizard: getFieldData('High Wizard'),
            Champion: getFieldData('Champion'),
            HighPriest: getFieldData('High Priest'),
            Paladin: getFieldData('Paladin'),
            DoramPhys: getFieldData('Doram Phys'),
            DoramMagic: getFieldData('Doram Magic'),
            Bench: getFieldData('Bench'),
            Absent: getFieldData('Absent')
        }
    };
}

function generateDynamicEmbed(eventId, event, description, timeLine) {
    const formatList = (list) => list.length > 0? list.join('\n') : '-';
    let roleTotal = 0;

    const newEmbed = new EmbedBuilder()
   .setTitle(event.title)
   .setColor('#F1C40F')
   .setDescription(description);

    JOBS.forEach(job => {
        if (event.limits[job.id] > 0) {
            newEmbed.addFields({
                name: `${job.emoji} ${job.label} (${event.players[job.id].length}/${event.limits[job.id]})`,
                value: formatList(event.players[job.id]),
                inline: true
            });
            roleTotal += event.players[job.id].length;
        }
    });

    newEmbed.addFields({ name: '\u200b', value: '----------------------------------------', inline: false });
    newEmbed.addFields({ name: `🪑 Bench (${event.players.Bench.length})`, value: formatList(event.players.Bench), inline: true });
    newEmbed.addFields({ name: `🅰️ Absent (${event.players.Absent.length})`, value: formatList(event.players.Absent), inline: true });

    const statusTotal = event.players.Bench.length + event.players.Absent.length;
    const grandTotal = roleTotal + statusTotal;

    newEmbed.setFooter({ text: `Sign ups: Total: ${grandTotal} - Role: ${roleTotal} - Status: ${statusTotal}\nEvent ID: ${eventId}\n${timeLine}` });
    return newEmbed;
}

function generateDynamicComponents(eventId, event) {
    const allRows = new Array();
    const buttonBuffer = new Array();

    JOBS.forEach(job => {
        if (event.limits[job.id] > 0) {
            buttonBuffer.push(
                new ButtonBuilder()
               .setCustomId(`role_${job.id}_${eventId}`)
               .setLabel(job.label)
               .setEmoji(job.customId)
               .setStyle(ButtonStyle.Secondary)
            );
        }
    });

    for (let i = 0; i < buttonBuffer.length; i += 5) {
        let chunk = buttonBuffer.slice(i, i + 5);
        allRows.push(new ActionRowBuilder().addComponents(chunk));
    }

    allRows.push(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
       .setCustomId(`status_${eventId}`)
       .setPlaceholder('Select a status')
       .addOptions(
                { label: 'Bench', value: 'Bench', emoji: '🪑' },
                { label: 'Absent', value: 'Absent', emoji: '🅰️' },
                { label: 'Remove Late', value: 'RemoveLate', emoji: '❌' },
                { label: 'Late (+5 min)', value: 'Late', emoji: '⏱️' }
            )
    ));

    allRows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`admin_close_${eventId}`).setLabel('Close Event').setEmoji('🔒').setStyle(ButtonStyle.Danger)
    ));

    return allRows;
}

function generatePaginationButtons(pageId, currentPage, totalPages) {
    let prevDisabled = false;
    if (currentPage === 0) {
        prevDisabled = true; 
    }

    let nextDisabled = false;
    let lastPage = totalPages - 1;
    if (currentPage === lastPage) {
        nextDisabled = true; 
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
       .setCustomId(`page_prev_${pageId}`)
       .setLabel('◀ Previous')
       .setStyle(ButtonStyle.Primary)
       .setDisabled(prevDisabled),
        new ButtonBuilder()
       .setCustomId(`page_next_${pageId}`)
       .setLabel('Next ▶')
       .setStyle(ButtonStyle.Primary)
       .setDisabled(nextDisabled)
    );

    return row;
}

async function backupToGoogleSheets(eventId, eventTitle, username, role, note) {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY;
    const sheetId = process.env.GOOGLE_SHEET_ID;

    let isConfigured = false;
    if (email && key && sheetId) isConfigured = true;
    if (!isConfigured) return;

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
        
        let existingRow;
        for (let i = 0; i < rows.length; i++) {
            let rowId = String(rows.at(i).get('EventID')).replace("'", "");
            let rowUser = rows.at(i).get('User');
            if (rowId === safeEventId && rowUser === username) {
                existingRow = rows.at(i);
            }
        }

        if (existingRow) {
            if (role) existingRow.set('Role', role);
            if (note) {
                if (note === 'RemoveLate') {
                    existingRow.set('Note', ''); 
                } else {
                    existingRow.set('Note', note); 
                }
            }
            existingRow.set('Title', eventTitle);
            existingRow.set('Time', new Date().toLocaleString());
            await existingRow.save(); 
        } else {
            let initialNote = '';
            if (note && note!== 'RemoveLate') initialNote = note;
            let initialRole = role? role : '';

            await sheet.addRow({ 
                EventID: eventId, 
                Title: eventTitle, 
                User: username, 
                Role: initialRole, 
                Note: initialNote,
                Time: new Date().toLocaleString() 
            });
        }
    } catch (error) {
        console.log("Google Sheets Error:", error);
    }
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.log("LOGIN ERROR: Could not connect to Discord.");
    console.error(error);
});
