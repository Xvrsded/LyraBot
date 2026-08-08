const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

async function loadCommands(client) {
    const commands = [];
    const foldersPath = path.join(__dirname, '../commands');
    
    if (!fs.existsSync(foldersPath)) {
        fs.mkdirSync(foldersPath, { recursive: true });
        return;
    }

    const commandFolders = fs.readdirSync(foldersPath);
    let count = 0;

    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        if (!fs.statSync(commandsPath).isDirectory()) continue;
        
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                commands.push(command.data.toJSON());
                count++;
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
    }

    const rest = new REST().setToken(process.env.TOKEN);

    try {
        console.log(`[BOOT] Started refreshing ${commands.length} application (/) commands.`);

        // Register to specific guild for development if GUILD_ID is provided, else globally
        if (process.env.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
            console.log(`[BOOT] Successfully reloaded ${commands.length} guild (/) commands.`);
        } else {
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
            console.log(`[BOOT] Successfully reloaded ${commands.length} global (/) commands.`);
        }
    } catch (error) {
        console.error(error);
    }
}

module.exports = { loadCommands };
