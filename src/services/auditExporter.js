class AuditExporter {
    /**
     * Formats an array of AuditEntry documents into a CSV string.
     * @param {Document[]} entries Array of Mongoose AuditEntry documents
     * @returns {string} CSV formatted text
     */
    toCSV(entries) {
        if (!entries || entries.length === 0) {
            return 'Timestamp,Audit ID,Correlation ID,Plugin,Action,Severity,Moderator ID,Target ID,Duration (ms),Reason\n';
        }

        const headers = [
            'Timestamp',
            'Audit ID',
            'Correlation ID',
            'Plugin',
            'Action',
            'Severity',
            'Moderator ID',
            'Target ID',
            'Duration (ms)',
            'Reason'
        ];

        const rows = entries.map(e => {
            const reason = e.metadata?.reason || '';
            return [
                e.timestamp ? e.timestamp.toISOString() : '',
                e.auditId,
                e.correlationId,
                e.plugin,
                e.action,
                e.severity,
                e.userId || '',
                e.targetId || '',
                e.duration || 0,
                reason
            ];
        });

        // Map values into quoted strings and escape double quotes
        const csvRows = [
            headers.join(','),
            ...rows.map(row => {
                return row.map(val => {
                    const strVal = String(val === null || val === undefined ? '' : val);
                    return `"${strVal.replace(/"/g, '""')}"`;
                }).join(',');
            })
        ];

        return csvRows.join('\n');
    }

    /**
     * Formats entries into stringified JSON.
     * @param {Document[]} entries 
     * @returns {string} JSON string
     */
    toJSON(entries) {
        return JSON.stringify(entries, null, 4);
    }
}

module.exports = new AuditExporter();
