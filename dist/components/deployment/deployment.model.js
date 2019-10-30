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
const mongoose = __importStar(require("mongoose"));
const regular_expressions_1 = require("../../utils/regular-expressions");
//-------------------------------------------------
// Schema
//-------------------------------------------------
const schema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
        maxLength: 44,
        validate: {
            validator: (value) => {
                return regular_expressions_1.kebabCaseRegex.test(value);
            },
            message: (props) => {
                return `Deployment id must be camel case. ${props.value} is not.`;
            }
        }
    },
    name: {
        type: String,
        required: true,
        maxlength: [40, 'name is too long']
    },
    description: {
        type: String,
        maxlength: [1000, 'description is too long'],
        default: ''
    },
    public: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: String
    }
}, {
    timestamps: true // automatically adds createdAt and updatedAt fields
});
//-------------------------------------------------
// Create Model (and expose it to our app)
//-------------------------------------------------
exports.default = mongoose.model('Deployment', schema);
//# sourceMappingURL=deployment.model.js.map