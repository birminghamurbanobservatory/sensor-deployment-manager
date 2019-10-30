"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
//-------------------------------------------------
// Dependencies
//-------------------------------------------------
const config_1 = require("./config");
const logger = __importStar(require("node-logger"));
const appName = require('../package.json').name; // Annoyingly if i use import here, the built app doesn't update.
const db_1 = require("./utils/db");
// import {initialiseEvents} from './events/initialise-events';
const correlator_1 = require("./utils/correlator");
// Handle Uncaught Errors - Make sure the logger is already configured first.
require("./utils/handle-uncaught-errors");
const initialise_events_1 = require("./events/initialise-events");
//-------------------------------------------------
// Logging
//-------------------------------------------------
logger.configure(Object.assign({}, config_1.config.logger, { getCorrelationId: correlator_1.getCorrelationId }));
logger.warn(`${appName} restarted`);
(async () => {
    //-------------------------------------------------
    // Database
    //-------------------------------------------------
    try {
        await db_1.connectDb(config_1.config.db.mongoUri);
        logger.info('Initial connection to database was successful');
    }
    catch (err) {
        logger.error(`Initial database connection failed: ${err.message}`);
    }
    //-------------------------------------------------
    // Events
    //-------------------------------------------------
    try {
        await initialise_events_1.initialiseEvents({
            url: config_1.config.events.url,
            appName,
            logLevel: config_1.config.events.logLevel
        });
    }
    catch (err) {
        logger.error('There was an issue whilst initialising events.', err);
    }
    return;
})();
//# sourceMappingURL=index.js.map