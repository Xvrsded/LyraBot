const fs = require('fs');
const lines = fs.readFileSync('scratch/clean_audit_results.txt', 'utf8').split('\n').filter(l => l.includes('|'));
let md = '# Clean Code Audit Report\n\n';
md += '| FILE | BARIS | ALASAN | DAMPAK | BOLEH DIHAPUS? |\n';
md += '| :--- | :--- | :--- | :--- | :---: |\n';
lines.forEach(line => {
    const [file, ln, reason] = line.trim().split('|');
    if (file) {
        md += `| ${file} | ${ln} | ${reason} | Tech Debt / Logging Gap | ${reason.includes('try/catch') ? 'NO' : 'YES'} |\n`;
    }
});
fs.writeFileSync('C:/Users/62813/.gemini/antigravity-ide/brain/64fd63ec-fa90-4a6a-a463-f8ee02f964b3/clean_code_audit.md', md);
