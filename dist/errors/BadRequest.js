"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const OperationalError_1 = require("./OperationalError");
class BadRequest extends OperationalError_1.OperationalError {
    constructor(message = 'Bad request') {
        super(message); // 'Error' breaks prototype chain here
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
        // Add a statusCode, useful when converting an error object to a HTTP response
        this.statusCode = 400;
    }
}
exports.BadRequest = BadRequest;
//# sourceMappingURL=BadRequest.js.map