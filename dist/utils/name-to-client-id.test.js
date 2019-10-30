"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const name_to_client_id_1 = require("./name-to-client-id");
//-------------------------------------------------
// Tests
//-------------------------------------------------
describe('name to clientId function', () => {
    test('Convert standard space separated name', () => {
        const name = 'reference weather stations';
        const expected = 'reference-weather-stations';
        expect(name_to_client_id_1.nameToClientId(name)).toBe(expected);
    });
    test('Removes any characters unsafe for a url', () => {
        const name = 'reference %*stat/ions';
        const expected = 'reference-stations';
        expect(name_to_client_id_1.nameToClientId(name)).toBe(expected);
    });
    test('Removes any upper case characters', () => {
        const name = 'Reference Weather Stations';
        const expected = 'reference-weather-stations';
        expect(name_to_client_id_1.nameToClientId(name)).toBe(expected);
    });
});
//# sourceMappingURL=name-to-client-id.test.js.map