"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const OperationalError_1 = require("./OperationalError");
class NotFound extends OperationalError_1.OperationalError {
    constructor(message = 'Resource not found') {
        super(message); // 'Error' breaks prototype chain here
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
        // Add a statusCode, useful when converting an error object to a HTTP response
        this.statusCode = 404;
    }
}
exports.NotFound = NotFound;
//# sourceMappingURL=NotFound.js.map