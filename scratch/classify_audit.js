const fs = require('fs');

const rawLines = fs.readFileSync('scratch/clean_audit_results.txt', 'utf16le').split('\n').filter(l => l.includes('|'));

let categories = {
    Critical: { count: 0, items: [], time: '10 mins/issue', required: 'YES' },
    Major: { count: 0, items: [], time: '5 mins/issue', required: 'YES' },
    Minor: { count: 0, items: [], time: '1 min/issue', required: 'NO' },
    Cosmetic: { count: 0, items: [], time: '1 min/issue', required: 'NO' }
};

rawLines.forEach(line => {
    let [file, ln, reason] = line.trim().split('|');
    if (!file) return;
    reason = reason.trim();

    let cat = 'Cosmetic';
    let impact = '';

    if (['try/catch missing AuditService', 'Mock', 'Dummy', 'Stub', 'Placeholder'].includes(reason)) {
        cat = 'Critical';
        impact = 'Silent Error / Potensi Fitur Tidak Bekerja';
    } else if (['Fallback renderer', 'Hardcoded Active', 'Hardcoded Verified', 'Hardcoded Operational', 'Hardcoded Healthy', 'Hardcoded Running'].includes(reason)) {
        cat = 'Major';
        impact = 'UI tidak akurat / Dead State';
    } else if (['console.log', 'TODO', 'FIXME', 'Temporary', 'Remove Later', 'Comment Temporary', 'Comment Debug'].includes(reason)) {
        cat = 'Minor';
        impact = 'Tech Debt / Maintainability';
    }

    categories[cat].count++;
    if (cat === 'Critical' && categories[cat].items.length < 20) {
        categories[cat].items.push({ file, ln, reason, impact });
    }
});

const total = rawLines.length;

let output = `| Kategori | Jumlah | Persentase | Estimasi Waktu Perbaikan | Wajib Diperbaiki (YES/NO)? |\n`;
output += `| :--- | :--- | :--- | :--- | :---: |\n`;
for (const [name, data] of Object.entries(categories)) {
    const pct = ((data.count / total) * 100).toFixed(2);
    output += `| **${name}** | ${data.count} | ${pct}% | ${data.time} | ${data.required} |\n`;
}

output += '\n### Top 20 Critical Issues\n\n';
categories.Critical.items.forEach((item, idx) => {
    output += `**${idx + 1}. File:** \`${item.file}\`\n`;
    output += `- **Baris:** ${item.ln}\n`;
    output += `- **Penyebab:** ${item.reason}\n`;
    output += `- **Dampak Runtime:** ${item.impact}\n`;
    output += `- **Prioritas:** TERTINGGI\n\n`;
});

fs.writeFileSync('scratch/classification_result.md', output);
console.log('Classification complete');
