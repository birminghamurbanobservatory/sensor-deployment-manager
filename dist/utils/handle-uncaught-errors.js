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
const logger = __importStar(require("node-logger"));
// Guide: https://www.loggly.com/blog/node-js-error-handling/
//-------------------------------------------------
// Uncaught Exception
//-------------------------------------------------
// Log the error using our custom logger before allowing the app to crash.
process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception occurred. Crashing app now.', err);
    process.exit(1);
});
//-------------------------------------------------
// Unhandled Rejection
//-------------------------------------------------
// Not using a proper .catch(…) rejection handler with Promises will cause an unhandledRejection event to be emitted. Let's log it so it can be inspected.
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection occurred. Check your Promise code.', { reason, promise });
});
//# sourceMappingURL=handle-uncaught-errors.js.map