const fs = require('fs');
const dir = './src/modules/adminPanel/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
console.log('Pages:', files.length);

const results = [];
for (const f of files) {
    const code = fs.readFileSync(dir + '/' + f, 'utf8');
    const requires = [...code.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
    const pluginCtxCalls = [...code.matchAll(/pluginCtx\.([a-zA-Z0-9_\.]+)/g)].map(m => m[1]);
    
    // Check module existence
    const missingRequires = requires.filter(req => {
        if (!req.startsWith('.')) return false; // ignore node_modules
        const reqPath = require('path').resolve(dir, req);
        const exists = fs.existsSync(reqPath) || fs.existsSync(reqPath + '.js') || fs.existsSync(reqPath + '/index.js') || fs.existsSync(reqPath + '.json');
        return !exists;
    });

    results.push({
        file: f,
        requires,
        missingRequires,
        pluginCtxCalls: [...new Set(pluginCtxCalls)]
    });
}
console.log(JSON.stringify(results, null, 2));
