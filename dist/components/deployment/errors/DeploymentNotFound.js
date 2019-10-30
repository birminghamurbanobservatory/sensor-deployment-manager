"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const NotFound_1 = require("../../../errors/NotFound");
class DeploymentNotFound extends NotFound_1.NotFound {
    constructor(message = 'Deployment could not be found') {
        super(message); // 'Error' breaks prototype chain here
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
    }
}
exports.DeploymentNotFound = DeploymentNotFound;
//# sourceMappingURL=DeploymentNotFound.js.map