"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load any environmental variables set in the .env file into process.env
const dotenv = __importStar(require("dotenv"));
dotenv.config();
// Retrieve each of our configuration components
const common = __importStar(require("./components/common"));
const logger = __importStar(require("./components/logger"));
const events = __importStar(require("./components/events"));
const db = __importStar(require("./components/db"));
// Export
exports.config = Object.assign({}, common, logger, events, db);
//# sourceMappingURL=index.js.map