const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const { JWT } = require('google-auth-library');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const chrono = require('chrono-node');

const app = express();
app.get('/', (req, res) => res.send('My bot is awake!'));

let port = process.env.PORT || 3000;
app.listen(port, () => console.log('Web server started'));

// PENTING: Tambahkan GatewayIntentBits.GuildMembers
// Pastikan "Server Members Intent" dinyalakan di Discord Developer Portal
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers 
    ]
});

const raidData = {};
const absenData = {};

client.once('ready', async () => {
    console.log(`Success! Logged in as ${client.user.tag}`);
    
    await client.application.commands.set([
        {
            name: 'raid',
            description: 'Create a Raid-Helper style event!',
            options: [
                { name: 'title', description: 'What is the name of the raid?', type: 3, required: true },
                { name: 'date', description: 'When? (e.g., tomorrow at 9pm, next friday)', type: 3, required: true }
            ]
        },
        {
            name: 'editraid',
            description: 'Edit the time of an existing raid',
            options: [
                { name: 'event_id', description: 'The ID at the bottom of the raid box', type: 3, required: true },
                { name: 'new_date', description: 'The new time (e.g., in 2 hours)', type: 3, required: true }
            ]
        },
        {
            name: 'absen',
            description: 'Buat list absen custom untuk class',
            options: [
                { name: 'title', description: 'Judul absen', type: 3, required: true },
                { name: 'lk', description: 'Jumlah max LK (0 jika tidak ada)', type: 4, required: true },
                { name: 'bard_dancer', description: 'Jumlah max Bard/Dancer (0 jika tidak ada)', type: 4, required: true },
                { name: 'sniper', description: 'Jumlah max Sniper (0 jika tidak ada)', type: 4, required: true },
                { name: 'bio', description: 'Jumlah max Bio Chemist (0 jika tidak ada)', type: 4, required: true },
                { name: 'ms', description: 'Jumlah max Mastersmith (0 jika tidak ada)', type: 4, required: true },
                { name: 'assasin', description: 'Jumlah max Assasin (0 jika tidak ada)', type: 4, required: true },
                { name: 'prof', description: 'Jumlah max Professor (0 jika tidak ada)', type: 4, required: true },
                { name: 'hw', description: 'Jumlah max High Wizard (0 jika tidak ada)', type: 4, required: true },
                { name: 'champ', description: 'Jumlah max Champion (0 jika tidak ada)', type: 4, required: true },
                { name: 'hp', description: 'Jumlah max High Priest (0 jika tidak ada)', type: 4, required: true },
                { name: 'paladin', description: 'Jumlah max Paladin (0 jika tidak ada)', type: 4, required: true },
                { name: 'doram_phys', description: 'Jumlah max Doram Phys (0 jika tidak ada)', type: 4, required: true },
                { name: 'doram_magic', description: 'Jumlah max Doram Magic (0 jika tidak ada)', type: 4, required: true }
            ]
        },
        {
            name: 'cekbid',
            description: 'Cek jadwal dan barang apa saja yang kamu bid dari Google Sheets'
        },
        {
            name: 'cekbidall',
            description: 'Cek seluruh list bid dari Google Sheets (Hanya terlihat olehmu)'
        },
        {
            name: 'cekleague',
            description: 'Cek barang apa saja yang kamu dapat dari League Prize'
        },
        {
            name: 'cekleagueall',
            description: 'Cek seluruh list League Prize (Hanya terlihat olehmu)'
        },
        {
            name: 'notifybid',
            description: '[ADMIN ONLY] Kirim DM peringatan ke semua member di list Bid Utama',
            default_member_permissions: String(PermissionFlagsBits.Administrator)
        },
        {
            name: 'notifyleague',
            description: '[ADMIN ONLY] Kirim DM peringatan ke semua member di list League Prize',
            default_member_permissions: String(PermissionFlagsBits.Administrator)
        }
    ]);
    console.log('Commands created!');
});

async function accessSpreadsheet(sheetIndex) {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY;
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!email || !key || !sheetId) {
        throw new Error('Google Credentials belum disetting di Environment Variables.');
    }

    const serviceAccountAuth = new JWT({
        email: email,
        key: key.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();
    return doc.sheetsByIndex[sheetIndex];
}

// Fungsi Delay untuk mencegah rate limit DM
const delay = ms => new Promise(res => setTimeout(res, ms));

async function sendMassDM(interaction, sheetIndex, listName) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const sheet = await accessSpreadsheet(sheetIndex);
        const rows = await sheet.getRows();

        if (rows.length === 0) {
            return interaction.editReply({ content: `❌ Sheet ${listName} kosong.` });
        }

        // Kelompokkan data berdasarkan player
        const playerBids = {};
        rows.forEach(row => {
            const playerRaw = row.get('Player yang Bid') || row.get('Player Yang Bid');
            if (!playerRaw) return;
            
            const player = playerRaw.toString().trim();
            if (player === '-' || player === '') return;

            const playerNameLowerCase = player.toLowerCase();
            const halaman = row.get('Halaman') || row.get('Hal');
            const item = row.get('Nama Item (Otomatis)') || row.get('Nama Barang');

            if (!playerBids[playerNameLowerCase]) {
                playerBids[playerNameLowerCase] = {
                    originalName: player,
                    items: []
                };
            }
            playerBids[playerNameLowerCase].items.push(`• **${item}** (Halaman ${halaman})`);
        });

        // Ambil SEMUA member di server (Butuh Server Members Intent nyala!)
        const guildMembers = await interaction.guild.members.fetch();
        
        let successCount = 0;
        let failCount = 0;
        let failNames = [];

        await interaction.editReply({ content: `⏳ Sedang memproses DM untuk daftar **${listName}**... Tolong jangan gunakan command ini lagi sampai selesai agar bot tidak error. Proses ini membutuhkan waktu sekitar ${Object.keys(playerBids).length * 2} detik.` });

        for (const [playerNameLowerCase, data] of Object.entries(playerBids)) {
            // Cari member yang cocok namanya (Username, Nickname Server, atau Global Name)
            const targetMember = guildMembers.find(m => 
                m.user.username.toLowerCase() === playerNameLowerCase ||
                (m.displayName && m.displayName.toLowerCase() === playerNameLowerCase) ||
                (m.user.globalName && m.user.globalName.toLowerCase() === playerNameLowerCase)
            );

            if (targetMember) {
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle(`📢 Pemberitahuan ${listName}`)
                        .setColor('#3498DB')
                        .setDescription(`Halo **${data.originalName}**, kamu terdaftar untuk mengambil barang di **${listName}**!\n\nBerikut rinciannya:\n${data.items.join('\n')}`)
                        .setFooter({ text: `Dikirim otomatis oleh bot dari list ${listName}` });

                    await targetMember.send({ embeds: [dmEmbed] });
                    successCount++;
                } catch (dmError) {
                    // Terjadi jika user menonaktifkan DM
                    failCount++;
                    failNames.push(`${data.originalName} (DM Tertutup)`);
                }
            } else {
                // Terjadi jika nama di Excel tidak sama dengan di Discord
                failCount++;
                failNames.push(`${data.originalName} (Tidak ditemukan di server)`);
            }

            // Jeda 2 detik setiap pengiriman agar tidak di-banned spam oleh Discord
            await delay(2000); 
        }

        let reportMessage = `✅ **Proses DM Massal Selesai!**\n\n`;
        reportMessage += `Berhasil terkirim: **${successCount} member**\n`;
        reportMessage += `Gagal terkirim: **${failCount} member**\n`;
        
        if (failNames.length > 0) {
            reportMessage += `\n**Daftar Gagal:**\n${failNames.join('\n')}`;
            if(reportMessage.length > 1900) {
                reportMessage = reportMessage.substring(0, 1900) + '... (terpotong karena terlalu panjang)';
            }
        }

        await interaction.editReply({ content: reportMessage });

    } catch (error) {
        console.error("Mass DM Error:", error);
        await interaction.editReply({ content: `❌ Terjadi kesalahan saat mencoba memproses mass DM: ${error.message}` });
    }
}

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        
        // --- COMMAND ABSEN ---
        if (interaction.commandName === 'absen') {
            await interaction.deferReply();
            
            const eventId = "absen_" + Date.now().toString();
            const title = interaction.options.getString('title');
            
            const limits = {
                LK: interaction.options.getInteger('lk'),
                BardDancer: interaction.options.getInteger('bard_dancer'),
                Sniper: interaction.options.getInteger('sniper'),
                Bio: interaction.options.getInteger('bio'),
                MS: interaction.options.getInteger('ms'),
                Assasin: interaction.options.getInteger('assasin'),
                Prof: interaction.options.getInteger('prof'),
                HW: interaction.options.getInteger('hw'),
                Champ: interaction.options.getInteger('champ'),
                HP: interaction.options.getInteger('hp'),
                Paladin: interaction.options.getInteger('paladin'),
                DoramPhys: interaction.options.getInteger('doram_phys'),
                DoramMagic: interaction.options.getInteger('doram_magic')
            };

            absenData[eventId] = {
                title: title,
                limits: limits,
                players: {
                    LK: [], BardDancer: [], Sniper: [], Bio: [], MS: [], 
                    Assasin: [], Prof: [], HW: [], Champ: [], HP: [], 
                    Paladin: [], DoramPhys: [], DoramMagic: []
                }
            };

            const embed = generateAbsenEmbed(eventId);
            const componentsArray = generateAbsenComponents(eventId);

            await interaction.editReply({ embeds: [embed], components: componentsArray });
        }

        // --- COMMAND NOTIFY BID (ADMIN ONLY) ---
        if (interaction.commandName === 'notifybid') {
            // Pengecekan admin ganda meskipun sudah di limit via command
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: "❌ Kamu tidak memiliki izin (Administrator) untuk menjalankan ini.", ephemeral: true });
            }
            await sendMassDM(interaction, 0, "Bid Utama");
        }

        // --- COMMAND NOTIFY LEAGUE (ADMIN ONLY) ---
        if (interaction.commandName === 'notifyleague') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: "❌ Kamu tidak memiliki izin (Administrator) untuk menjalankan ini.", ephemeral: true });
            }
            // Sheet League Prize ada di Index 2
            await sendMassDM(interaction, 2, "League Prize");
        }

        // --- COMMAND CEK BID ALL ---
        if (interaction.commandName === 'cekbidall' || interaction.commandName === 'cekleagueall') {
            await interaction.deferReply({ ephemeral: true });
            
            let sheetIndex = interaction.commandName === 'cekbidall' ? 0 : 2;
            let titleSource = interaction.commandName === 'cekbidall' ? "Bid List Utama" : "League Prize";

            try {
                const sheet = await accessSpreadsheet(sheetIndex);
                const rows = await sheet.getRows();

                if (rows.length === 0) {
                    return interaction.editReply({ content: `❌ Sheet ${titleSource} kosong.` });
                }

                let allBids = [];
                rows.forEach(row => {
                    const player = row.get('Player yang Bid') || row.get('Player Yang Bid');
                    const halaman = row.get('Halaman') || row.get('Hal');
                    const item = row.get('Nama Item (Otomatis)') || row.get('Nama Barang');

                    if (player && player !== '-' && player !== '') {
                        allBids.push(`**${player}** - Halaman ${halaman}: ${item}`);
                    }
                });

                if (allBids.length === 0) {
                    return interaction.editReply({ content: `Belum ada data bid yang terisi di ${titleSource}.` });
                }

                let currentPage = 0;
                const itemsPerPage = 15;
                const totalPages = Math.ceil(allBids.length / itemsPerPage);

                const getEmbed = (page) => {
                    const start = page * itemsPerPage;
                    const end = start + itemsPerPage;
                    const pageData = allBids.slice(start, end);

                    return new EmbedBuilder()
                        .setTitle(`📋 Daftar Semua Orang (${titleSource})`)
                        .setColor('#9B59B6')
                        .setDescription(pageData.join('\n'))
                        .setFooter({ text: `Halaman ${page + 1} dari ${totalPages} | Total ${allBids.length} Bid` });
                };

                const getButtons = (page) => {
                    return new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`prev_page_${interaction.commandName}`)
                            .setLabel('⬅️ Prev')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === 0),
                        new ButtonBuilder()
                            .setCustomId(`next_page_${interaction.commandName}`)
                            .setLabel('Next ➡️')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === totalPages - 1)
                    );
                };

                const message = await interaction.editReply({ 
                    embeds: [getEmbed(currentPage)], 
                    components: totalPages > 1 ? [getButtons(currentPage)] : []
                });

                if (totalPages > 1) {
                    const collector = message.createMessageComponentCollector({ time: 600000 }); // 10 menit

                    collector.on('collect', async (i) => {
                        if (i.customId === `prev_page_${interaction.commandName}` && currentPage > 0) {
                            currentPage--;
                        } else if (i.customId === `next_page_${interaction.commandName}` && currentPage < totalPages - 1) {
                            currentPage++;
                        }
                        
                        await i.update({ 
                            embeds: [getEmbed(currentPage)], 
                            components: [getButtons(currentPage)] 
                        });
                    });

                    collector.on('end', () => {
                        interaction.editReply({ components: [] }).catch(console.error);
                    });
                }

            } catch (error) {
                console.error("CekBidAll Error:", error);
                await interaction.editReply({ content: `❌ Terjadi kesalahan: ${error.message}` });
            }
        }

        // --- COMMAND CEK BID DIRI SENDIRI ---
        if (interaction.commandName === 'cekbid' || interaction.commandName === 'cekleague') {
            await interaction.deferReply(); 

            let sheetIndex = interaction.commandName === 'cekbid' ? 0 : 2;
            let titleSource = interaction.commandName === 'cekbid' ? "Bid List" : "League Prize";

            const username = interaction.member.displayName.toLowerCase();
            const discordName = interaction.user.username.toLowerCase();

            try {
                const sheet = await accessSpreadsheet(sheetIndex);
                const rows = await sheet.getRows();

                let foundBids = [];

                rows.forEach(row => {
                    const player = row.get('Player yang Bid') || row.get('Player Yang Bid');
                    if (player) {
                        const playerLowerCase = player.toString().toLowerCase();
                        if (playerLowerCase === username || playerLowerCase === discordName) {
                            const halaman = row.get('Halaman') || row.get('Hal');
                            const item = row.get('Nama Item (Otomatis)') || row.get('Nama Barang');
                            foundBids.push(`- **Halaman ${halaman}**: ${item}`);
                        }
                    }
                });

                if (foundBids.length > 0) {
                    const embed = new EmbedBuilder()
                        .setTitle(`📦 Data ${titleSource} untuk ${interaction.member.displayName}`)
                        .setColor('#2ECC71')
                        .setDescription(`Halo! Berikut adalah daftar item yang kamu dapatkan:\n\n${foundBids.join('\n')}`);
                    
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.editReply({ content: `Halo ${interaction.member.displayName}, nama kamu tidak ada di ${titleSource} saat ini. Pastikan namamu di Discord sama dengan nama di tabel Google Sheets.` });
                }

            } catch (error) {
                console.log("Google Sheets CekBid Error:", error);
                await interaction.editReply({ content: `❌ Terjadi kesalahan saat membaca Google Sheets: ${error.message}` });
            }
        }

        // --- (KODE LAMA RAID & EDIT RAID TETAP ADA DI SINI) ---
        if (interaction.commandName === 'raid') {
             await interaction.deferReply(); 

             let eventId = "1";
             const customTitle = interaction.options.getString('title');
             const customDateString = interaction.options.getString('date');
             
             const parsedDate = chrono.parseDate(customDateString);
             if (!parsedDate) {
                 return interaction.editReply({ content: '❌ Format tanggal tidak dimengerti. Coba "tomorrow at 9pm".' });
             }
             const unixTime = Math.floor(parsedDate.getTime() / 1000);

             try {
                const sheet = await accessSpreadsheet(0);
                const rows = await sheet.getRows();

                let lastId = 0;
                if (rows.length > 0) {
                    for (let i = 0; i < rows.length; i++) {
                        let val = rows.at(i).get('EventID');
                        if (val) {
                            let rowId = parseInt(String(val).replace("'", ""));
                            if (rowId > lastId) lastId = rowId;
                        }
                    }
                }
                let nextIdNum = lastId + 1;
                eventId = nextIdNum.toString();
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
                     Sniper: [], Priest: [], Paladin: [],
                     DancerBard: [], Bio: [], Bench: [], Absent: []
                 }
             };

             const embed = generateRaidEmbed(eventId);
             const components = generateRaidComponents(eventId);

             const reply = await interaction.editReply({ embeds: [embed], components: components });
             raidData[eventId].messageId = reply.id;
             raidData[eventId].channelId = reply.channelId;
        }

        if (interaction.commandName === 'editraid') {
             const eventId = interaction.options.getString('event_id');
             const newDateString = interaction.options.getString('new_date');
             const event = raidData[eventId];

             if (!event) {
                 return interaction.reply({ content: '❌ Event not found or expired.', ephemeral: true });
             }

             const parsedDate = chrono.parseDate(newDateString);
             if (!parsedDate) {
                 return interaction.reply({ content: '❌ Format tanggal tidak dimengerti.', ephemeral: true });
             }

             event.time = Math.floor(parsedDate.getTime() / 1000);

             const channel = await client.channels.fetch(event.channelId);
             const message = await channel.messages.fetch(event.messageId);
             const updatedEmbed = generateRaidEmbed(eventId);
             
             await message.edit({ embeds: [updatedEmbed] });
             return interaction.reply({ content: `✅ Waktu event berhasil diubah!`, ephemeral: true });
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId.startsWith('prev_page_') || interaction.customId.startsWith('next_page_')) {
            return; 
        }
        await processAbsenClick(interaction);
    }
});

function generateAbsenEmbed(eventId) {
    const event = absenData[eventId];
    const formatList = (list) => list.length > 0 ? list.join('\n') : '-';

    const embed = new EmbedBuilder()
        .setTitle(event.title)
        .setColor('#E67E22')
        .setDescription(`Silahkan klik tombol di bawah untuk absen class.`);

    const fieldMap = [
        { key: 'LK', emoji: '⚔️', name: 'Lord Knight' },
        { key: 'Paladin', emoji: '🛡️', name: 'Paladin' },
        { key: 'Assasin', emoji: '🗡️', name: 'Assasin' },
        { key: 'Sniper', emoji: '🏹', name: 'Sniper' },
        { key: 'BardDancer', emoji: '🎸', name: 'Bard/Dancer' },
        { key: 'MS', emoji: '🔨', name: 'Mastersmith' },
        { key: 'Bio', emoji: '🧪', name: 'Bio Chemist' },
        { key: 'HW', emoji: '🧙', name: 'High Wizard' },
        { key: 'Prof', emoji: '📖', name: 'Professor' },
        { key: 'HP', emoji: '⛑️', name: 'High Priest' },
        { key: 'Champ', emoji: '🥊', name: 'Champion' },
        { key: 'DoramPhys', emoji: '🐱', name: 'Doram Phys' },
        { key: 'DoramMagic', emoji: '😺', name: 'Doram Magic' }
    ];

    let totalSlot = 0;
    fieldMap.forEach(job => {
        if (event.limits[job.key] > 0) {
            embed.addFields({ 
                name: `${job.emoji} ${job.name} (${event.players[job.key].length}/${event.limits[job.key]})`, 
                value: formatList(event.players[job.key]), 
                inline: true 
            });
            totalSlot += event.limits[job.key];
        }
    });

    let totalTerisi = 0;
    for (const key in event.players) {
        totalTerisi += event.players[key].length;
    }

    embed.setFooter({ text: `Total Absen: ${totalTerisi}/${totalSlot}` });
    return embed;
}

function generateAbsenComponents(eventId) {
    const event = absenData[eventId];
    const componentsArray = [];
    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;

    const buttonConfigs = [
        { id: 'LK', label: 'LK', emoji: '⚔️' },
        { id: 'Paladin', label: 'Paladin', emoji: '🛡️' },
        { id: 'Assasin', label: 'Assasin', emoji: '🗡️' },
        { id: 'Sniper', label: 'Sniper', emoji: '🏹' },
        { id: 'BardDancer', label: 'Bard/Dancer', emoji: '🎸' },
        { id: 'MS', label: 'MS', emoji: '🔨' },
        { id: 'Bio', label: 'Bio', emoji: '🧪' },
        { id: 'HW', label: 'HW', emoji: '🧙' },
        { id: 'Prof', label: 'Prof', emoji: '📖' },
        { id: 'HP', label: 'HP', emoji: '⛑️' },
        { id: 'Champ', label: 'Champ', emoji: '🥊' },
        { id: 'DoramPhys', label: 'Doram P.', emoji: '🐱' },
        { id: 'DoramMagic', label: 'Doram M.', emoji: '😺' }
    ];

    buttonConfigs.forEach(btn => {
        if (event.limits[btn.id] > 0) {
            currentRow.addComponents(
                new ButtonBuilder().setCustomId(`absen_${btn.id}_${eventId}`).setLabel(btn.label).setEmoji(btn.emoji).setStyle(ButtonStyle.Secondary)
            );
            buttonCount++;

            if (buttonCount === 5) {
                componentsArray.push(currentRow);
                currentRow = new ActionRowBuilder();
                buttonCount = 0;
            }
        }
    });

    if (buttonCount > 0) {
        componentsArray.push(currentRow);
    }

    const unregRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`absen_unreg_${eventId}`).setLabel('Batal Absen').setStyle(ButtonStyle.Danger)
    );
    componentsArray.push(unregRow);

    return componentsArray;
}

async function processAbsenClick(interaction) {
    try {
        const parts = interaction.customId.split('_');
        if (parts[0] !== 'absen') return; 

        await interaction.deferUpdate();

        const action = parts[1]; 
        const eventId = parts.slice(2).join('_'); 

        const event = absenData[eventId];
        if (!event) {
            return interaction.followUp({ content: '❌ Data absen ini sudah kadaluarsa atau error.', ephemeral: true });
        }

        const userName = interaction.member.displayName;

        for (const key in event.players) {
            event.players[key] = event.players[key].filter(name => name !== userName);
        }

        if (action !== 'unreg') {
            if (event.players[action].length >= event.limits[action]) {
                return interaction.followUp({ content: `❌ Slot untuk role **${action}** sudah penuh!`, ephemeral: true });
            }
            event.players[action].push(userName);
        }

        const newEmbed = generateAbsenEmbed(eventId);
        await interaction.editReply({ embeds: [newEmbed] });

        if (action === 'unreg') {
            await interaction.followUp({ content: "✅ Kamu berhasil membatalkan absen.", ephemeral: true });
        }

    } catch (error) {
        console.log("ABSEN CLICK ERROR:", error);
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: `❌ Error caught: ${error.message}`, ephemeral: true }).catch(console.error);
        } else {
            await interaction.reply({ content: `❌ Error caught: ${error.message}`, ephemeral: true }).catch(console.error);
        }
    }
}

// --- FUNGSI LAMA RAID BOT BAWAH SINI ---
function generateRaidEmbed(eventId) {
    const event = raidData[eventId];
    const formatList = (list) => list.length > 0 ? list.join('\n') : '-';

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

    return [buttons, selectMenu, adminControls];
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.log("LOGIN ERROR: Could not connect to Discord.");
    console.error(error);
});
