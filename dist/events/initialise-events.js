"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const event = __importStar(require("event-stream"));
const logger = __importStar(require("node-logger"));
const correlator_1 = require("../utils/correlator");
const subscriptions_1 = require("./subscriptions");
async function initialiseEvents(settings) {
    logger.debug('Initalising events stream');
    if (logIt('error', settings.logLevel)) {
        event.logsEmitter.on('error', (msg) => {
            logger.error(msg);
        });
    }
    if (logIt('warn', settings.logLevel)) {
        event.logsEmitter.on('warn', (msg) => {
            logger.warn(msg);
        });
    }
    if (logIt('info', settings.logLevel)) {
        event.logsEmitter.on('info', (msg) => {
            logger.info(msg);
        });
    }
    if (logIt('debug', settings.logLevel)) {
        event.logsEmitter.on('debug', (msg) => {
            logger.debug(msg);
        });
    }
    try {
        await event.init({
            url: settings.url,
            appName: settings.appName,
            withCorrelationId: correlator_1.withCorrelationId,
            getCorrelationId: correlator_1.getCorrelationId
        });
    }
    catch (err) {
        logger.error(`Failed to initialise event-stream. Reason: ${err.message}`);
    }
    function logIt(level, configSetting) {
        const levels = ['debug', 'info', 'warn', 'error'];
        return levels.indexOf(level) >= levels.indexOf(configSetting);
    }
    // Add the subscriptions even if the init failed (e.g. because RabbitMQ wasn't turned on yet), this ensures the subscriptions get added to the list and will be automatically re-established if the connection returns.
    await subscriptions_1.invokeAllSubscriptions();
}
exports.initialiseEvents = initialiseEvents;
//# sourceMappingURL=initialise-events.js.map