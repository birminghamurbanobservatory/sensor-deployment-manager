"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
//-------------------------------------------------
// Dependencies
//-------------------------------------------------
const joi = __importStar(require("@hapi/joi"));
//-------------------------------------------------
// Validation Schema
//-------------------------------------------------
const schema = joi.object({
    NODE_ENV: joi.string()
        .valid('development', 'production', 'test') // allow only these values
        .required()
}).unknown() // allows for extra fields (i.e that we don't check for) in the object being checked.
    .required();
//-------------------------------------------------
// Validate
//-------------------------------------------------
// i.e. check that process.env contains all the environmental variables we expect/need.
// It's important to use the 'value' that joi.validate spits out from now on, as joi has the power to do type conversion and add defaults, etc, and thus it may be different from the original process.env. 
const { error: err, value: envVars } = schema.validate(process.env);
if (err) {
    throw new Error(`An error occured whilst validating process.env: ${err.message}`);
}
//-------------------------------------------------
// Create config object
//-------------------------------------------------
// Pull out the properties we need to create this particular config object. 
exports.common = {
    env: envVars.NODE_ENV
};
//# sourceMappingURL=common.js.map