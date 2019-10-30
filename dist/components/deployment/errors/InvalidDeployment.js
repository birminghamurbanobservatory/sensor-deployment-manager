"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BadRequest_1 = require("../../../errors/BadRequest");
class InvalidDeployment extends BadRequest_1.BadRequest {
    constructor(message = 'Invalid deployment') {
        super(message); // 'Error' breaks prototype chain here
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    }
}
exports.InvalidDeployment = InvalidDeployment;
//# sourceMappingURL=InvalidDeployment.js.map