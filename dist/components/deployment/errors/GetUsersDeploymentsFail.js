"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DatabaseError_1 = require("../../../errors/DatabaseError");
class GetUsersDeploymentsFail extends DatabaseError_1.DatabaseError {
    constructor(message = `Failed to get user's deployments.`, privateMessage) {
        super(message); // 'Error' breaks prototype chain here
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
        // Add a private message, which can for logged for extra detail, but should not be sent to the client.
        this.privateMessage = privateMessage;
    }
}
exports.GetUsersDeploymentsFail = GetUsersDeploymentsFail;
//# sourceMappingURL=GetUsersDeploymentsFail.js.map