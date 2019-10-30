"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Conflict_1 = require("../../../errors/Conflict");
class DeploymentAlreadyExists extends Conflict_1.Conflict {
    constructor(message = 'Deployment already exists') {
        super(message); // 'Error' breaks prototype chain here
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
    }
}
exports.DeploymentAlreadyExists = DeploymentAlreadyExists;
//# sourceMappingURL=DeploymentAlreadyExists.js.map