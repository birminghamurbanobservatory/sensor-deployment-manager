"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BadRequest_1 = require("../errors/BadRequest");
class InvalidGeometry extends BadRequest_1.BadRequest {
    constructor(message = 'Invalid GeoJSON') {
        super(message); // 'Error' breaks prototype chain here
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    }
}
exports.InvalidGeometry = InvalidGeometry;
//# sourceMappingURL=InvalidGeometry.js.map