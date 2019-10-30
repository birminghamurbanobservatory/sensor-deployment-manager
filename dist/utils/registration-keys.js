"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const password_generator_1 = __importDefault(require("password-generator"));
// Can't seem to load this with an import statement.
function generateRegistrationKey() {
    return password_generator_1.default();
}
exports.generateRegistrationKey = generateRegistrationKey;
//# sourceMappingURL=registration-keys.js.map