"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BadRequest_1 = require("../../../errors/BadRequest");
class InvalidDeploymentUpdates extends BadRequest_1.BadRequest {
    constructor(message = 'Invalid updates to deployment') {
        super(message); // 'Error' breaks prototype chain here
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    }
}
exports.InvalidDeploymentUpdates = InvalidDeploymentUpdates;
//# sourceMappingURL=InvalidDeploymentUpdates.js.map