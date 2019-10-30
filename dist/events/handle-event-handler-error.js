"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const OperationalError_1 = require("../errors/OperationalError");
const UnexpectedError_1 = require("../errors/UnexpectedError");
const logger = __importStar(require("node-logger"));
function logCensorAndRethrow(eventName, err) {
    //------------------------
    // Operational Errors
    //------------------------
    if (err instanceof OperationalError_1.OperationalError) {
        logger.warn(`Operational error whilst handling ${eventName} event.`, err);
        throw err;
        //------------------------
        // Programmer Errors
        //------------------------
    }
    else {
        logger.error(`Unexpected error whilst handling ${eventName} event.`, err);
        // We don't want the event stream to return programmer errors.
        throw new UnexpectedError_1.UnexpectedError();
    }
}
exports.logCensorAndRethrow = logCensorAndRethrow;
//# sourceMappingURL=handle-event-handler-error.js.map