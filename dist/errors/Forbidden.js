"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const OperationalError_1 = require("./OperationalError");
class Forbidden extends OperationalError_1.OperationalError {
    constructor(message = 'Forbidden') {
        super(message); // 'Error' breaks prototype chain here
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
        // Add a statusCode, useful when converting an error object to a HTTP response
        this.statusCode = 403;
    }
}
exports.Forbidden = Forbidden;
//# sourceMappingURL=Forbidden.js.map