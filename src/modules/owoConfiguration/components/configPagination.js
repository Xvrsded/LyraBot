class ConfigPagination {
    render(items, currentPage = 0, itemsPerPage = 5) {
        const totalPages = Math.ceil(items.length / itemsPerPage);
        const start = currentPage * itemsPerPage;
        const pageItems = items.slice(start, start + itemsPerPage);

        const components = [];
        if (currentPage > 0) components.push({ type: 'button', label: 'Prev', id: `config_prev_${currentPage - 1}` });
        if (currentPage < totalPages - 1) components.push({ type: 'button', label: 'Next', id: `config_next_${currentPage + 1}` });

        return {
            items: pageItems,
            components,
            text: `Page ${currentPage + 1} of ${totalPages || 1}`
        };
    }
}
module.exports = new ConfigPagination();
