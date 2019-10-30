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
const mongoose = require('mongoose'); // .on doesn't work if I load using import
const logger = __importStar(require("node-logger"));
// plug-in bluebird promise library
mongoose.Promise = require('bluebird');
// Log successful connections and connection errors.
const db = mongoose.connection;
db.on('open', () => {
    logger.info('Succesfully connected to MongoDB database');
});
db.on('error', (err) => {
    logger.error('DB Connection Error', err);
});
//-------------------------------------------------
// Connect
//-------------------------------------------------
// Docs: https://mongoosejs.com/docs/connections.html
function connectDb(uri) {
    // Resolves when the database is ready to use. However, because mongoose is clever enough to buffer model function calls internally you can start using you models immediately without having to wait for this to resolve. N.B. mongoose.connect() resolves to undefined.
    // This promise will reject if there was an initial connection error.
    // The options here help surpress some deprecation warnings on startup.
    return mongoose.connect(uri, {
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false,
        useUnifiedTopology: true
    });
}
exports.connectDb = connectDb;
//-------------------------------------------------
// Disconnect
//-------------------------------------------------
function disconnectDb() {
    return mongoose.disconnect()
        .then(() => {
        return;
    });
}
exports.disconnectDb = disconnectDb;
//# sourceMappingURL=db.js.map