async function processClick(interaction, isButton) {
    const parts = interaction.customId.split('_');
    let eventId = isButton? parts[1] : parts[2];
    let choice = isButton? parts[2] : interaction.values.at(0);

    if (choice === 'Late' |

| choice === 'RemoveLate') {
        return interaction.reply({ content: "⏱️ Your status has been noted!", ephemeral: true });
    }

    // TRICK: Read the existing message directly from Discord instead of memory!
    const receivedEmbed = interaction.message.embeds;
    const fields = receivedEmbed.fields;

    // Helper to read the names currently inside the embed columns
    const parseField = (index) => {
        const value = fields[index].value;
        return value === '-'? new Array() : value.split('\n');
    };

    // Rebuild the event data directly from the visual box!
    const event = {
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

    // Remove user from all other roles first
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

    // Calculate the new totals for the footer
    const roleTotal = event.players.Sniper.length + event.players.Priest.length + event.players.Paladin.length + event.players.DancerBard.length + event.players.Bio.length;
    const statusTotal = event.players.Bench.length + event.players.Absent.length;
    const grandTotal = roleTotal + statusTotal;

    // Grab the original start time from the old footer
    const oldFooter = receivedEmbed.footer.text;
    const timeLine = oldFooter.split('\n')[1]; 

    // Rebuild the fields with the new data
    const formatList = (list) => list.length > 0? list.join('\n') : '-';
    
    const newEmbed = EmbedBuilder.from(receivedEmbed)
       .setFields(
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

    // Instantly update the message!
    await interaction.update({ embeds: new Array(newEmbed) });

    // Backup to Google Sheets (Fixed to prevent scientific notation corruption)
    await backupToGoogleSheets(`'${eventId}`, userName, choice); 
}
