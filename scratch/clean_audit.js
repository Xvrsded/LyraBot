const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            walk(filePath, fileList);
        } else if (filePath.endsWith('.js')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

const files = walk(path.join(__dirname, '../src'));

const results = [];

const patterns = [
    { name: 'TODO', regex: /TODO/i },
    { name: 'FIXME', regex: /FIXME/i },
    { name: 'Dummy', regex: /dummy/i },
    { name: 'Mock', regex: /mock/i },
    { name: 'Placeholder', regex: /placeholder/i },
    { name: 'Stub', regex: /stub/i },
    { name: 'Temporary', regex: /temporary/i },
    { name: 'Hardcoded Active', regex: /["'`]Active["'`]/i },
    { name: 'Hardcoded Verified', regex: /["'`]Verified["'`]/i },
    { name: 'Hardcoded Operational', regex: /["'`]Operational["'`]/i },
    { name: 'Hardcoded Healthy', regex: /["'`]Healthy["'`]/i },
    { name: 'Hardcoded Running', regex: /["'`]Running["'`]/i },
    { name: 'Remove Later', regex: /\/\/\s*remove later/i },
    { name: 'Comment Temporary', regex: /\/\/\s*temporary/i },
    { name: 'Comment Debug', regex: /\/\/\s*debug/i },
    { name: 'console.log', regex: /console\.log\(/ },
    { name: 'Fallback renderer', regex: /Fallback/i }
];

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    
    // Check line by line for patterns
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        patterns.forEach(p => {
            if (p.regex.test(line)) {
                results.push({ file: file.replace(/\\/g, '/').split('/src/')[1], line: lineNum, reason: p.name, impact: 'Tech Debt / Not Production Ready', canDelete: 'YES' });
            }
        });
    });

    // Try-Catch without AuditService
    const tryCatchBlocks = content.match(/catch\s*\([^)]*\)\s*\{[^}]*\}/g);
    if (tryCatchBlocks) {
        tryCatchBlocks.forEach(block => {
            if (!block.includes('audit.error') && !block.includes('AuditService') && !block.includes('pluginCtx.audit') && !block.includes('logger.error') && !block.includes('Audit')) {
                results.push({ file: file.replace(/\\/g, '/').split('/src/')[1], line: '?', reason: 'try/catch missing AuditService', impact: 'Silent Error / Logging Gap', canDelete: 'NO' });
            }
        });
    }
});

console.log('--- AUDIT RESULTS ---');
results.forEach(r => {
    console.log(`${r.file}|${r.line}|${r.reason}`);
});
console.log(`TOTAL ISSUES: ${results.length}`);
