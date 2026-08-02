function fmt(level, message, meta) {
    const suffix = meta ? ' ' + JSON.stringify(meta) : '';
    // Always route through console.error so stdout stays clean for MCP stdio transport.
    console.error(`[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${suffix}`);
}
const logger = {
    debug(message, meta) {
        if ((process.env.LOG_LEVEL || 'info') === 'debug')
            fmt('debug', message, meta);
    },
    info(message, meta) {
        fmt('info', message, meta);
    },
    warn(message, meta) {
        fmt('warn', message, meta);
    },
    error(message, meta) {
        fmt('error', message, meta);
    }
};
export default logger;
//# sourceMappingURL=logger.mjs.map