"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const registration_keys_1 = require("./registration-keys");
//-------------------------------------------------
// Tests
//-------------------------------------------------
describe('Test generateRegistrationKey function', () => {
    test('Check a selection of generated keys are as expected', () => {
        const keys = [];
        const n = 10;
        for (let i = 0; i < n; i++) {
            keys.push(registration_keys_1.generateRegistrationKey());
        }
        keys.forEach((key) => {
            expect(key.length).toBe(10);
            expect(isLowercaseAlpha(key)).toBe(true);
        });
    });
});
function isLowercaseAlpha(str) {
    const reg = /^[a-z]*$/;
    return reg.test(str);
}
//# sourceMappingURL=registration-keys.test.js.map