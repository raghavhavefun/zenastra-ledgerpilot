// Lightweight console-based logger stub replacing winston.
// Keeps the same call shape used by ported code: logger.debug/info/warn/error(msg, meta?)
type LogMeta = Record<string, unknown> | undefined;

function fmt(level: string, message: string, meta?: LogMeta): void {
    const suffix = meta ? ' ' + JSON.stringify(meta) : '';
    // Always route through console.error so stdout stays clean for MCP stdio transport.
    console.error(`[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${suffix}`);
}

const logger = {
    debug(message: string, meta?: LogMeta): void {
        if ((process.env.LOG_LEVEL || 'info') === 'debug') fmt('debug', message, meta);
    },
    info(message: string, meta?: LogMeta): void {
        fmt('info', message, meta);
    },
    warn(message: string, meta?: LogMeta): void {
        fmt('warn', message, meta);
    },
    error(message: string, meta?: LogMeta): void {
        fmt('error', message, meta);
    }
};

export default logger;
