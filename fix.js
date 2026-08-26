const fs = require('fs');
const files = [
    'src/events/guildBanAdd.js',
    'src/events/guildMemberUpdate.js',
    'src/events/guildMemberAdd.js',
    'src/commands/moderation/warn.js',
    'src/commands/moderation/warnings.js',
    'src/commands/moderation/clearwarnings.js',
    'src/events/presenceUpdate.js',
    'src/events/guildScheduledEventUpdate.js'
];
for (const f of files) {
    if (!fs.existsSync(f)) continue;
    let t = fs.readFileSync(f, 'utf8');
    t = t.replace(/<\@ \+/g, "'<@' +");
    t = t.replace(/\+ \>/g, "+ '>'");
    t = t.replace(/\<\@\ \+/g, "'<@' +");
    t = t.replace(/\+ \\>\/g, "+ '>'");
    t = t.replace(/\+ minutes/g, "+ ' minutes'");
    t = t.replace(/<\@\& \+/g, "'<@&' +");
    t = t.replace(/\<\@\&\ \+/g, "'<@&' +");
    t = t.replace(/\TIMEOUT-\/g, "'TIMEOUT-'");
    t = t.replace(/\BAN-\/g, "'BAN-'");
    t = t.replace(/\WARN-\/g, "'WARN-'");
    t = t.replace(/\<t:\ \+/g, "'<t:' +");
    t = t.replace(/\+ \:d\>\/g, "+ ':d>'");
    t = t.replace(/\[Watch Stream\]\(\/g, "'[Watch Stream]('");
    t = t.replace(/\[Klik di sini\]\(\/g, "'[Klik di sini]('");
    t = t.replace(/\+ \\)\/g, "+ ')'");
    
    fs.writeFileSync(f, t);
}
