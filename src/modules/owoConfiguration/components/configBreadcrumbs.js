class ConfigBreadcrumbs {
    render(path) {
        return `**Overview** > ${path.join(' > ')}\n\n`;
    }
}
module.exports = new ConfigBreadcrumbs();
