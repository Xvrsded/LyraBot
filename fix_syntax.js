const fs = require('fs');
const path = 'src/services/storeService.js';
let content = fs.readFileSync(path, 'utf8');

// The write_to_file tool literally wrote backslashes because I escaped them in the JSON string
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');
content = content.replace(/\\\\n/g, '\\n');
content = content.replace(/\\\\u200b/g, '\\u200b');

fs.writeFileSync(path, content);
console.log('Fixed syntax in storeService.js');
