"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const OperationalError_1 = require("./OperationalError");
class DatabaseError extends OperationalError_1.OperationalError {
    constructor(message = 'A database error occurred', privateMessage) {
        super(message); // 'Error' breaks prototype chain here
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
        // Add a private message, which can for logged for extra detail, but should not be sent to the client.
        this.privateMessage = privateMessage;
    }
}
exports.DatabaseError = DatabaseError;
//# sourceMappingURL=DatabaseError.js.map