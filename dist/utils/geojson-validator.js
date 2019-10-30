"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const geojsonhint = __importStar(require("@mapbox/geojsonhint"));
const check = __importStar(require("check-types"));
const InvalidGeometry_1 = require("./InvalidGeometry");
function validateGeometry(geometry) {
    if (check.not.nonEmptyObject(geometry)) {
        throw new InvalidGeometry_1.InvalidGeometry('Geometry must be a non-empty object');
    }
    if (check.assigned(geometry.geometry)) {
        throw new InvalidGeometry_1.InvalidGeometry(`The geometry object must not contain a key called 'geometry'`);
    }
    if (check.assigned(geometry.properties)) {
        throw new InvalidGeometry_1.InvalidGeometry(`The geometry object must not contain a key called 'properties'`);
    }
    const result = geojsonhint.hint(geometry);
    // Passed
    if (result.length === 0) {
        return;
        // Failed
    }
    else {
        // There may be more than one error, but let's just return the first.
        throw new InvalidGeometry_1.InvalidGeometry(result[0].message);
    }
}
exports.validateGeometry = validateGeometry;
//# sourceMappingURL=geojson-validator.js.map