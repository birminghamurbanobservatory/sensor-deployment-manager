"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const OperationalError_1 = require("./OperationalError");
//-------------------------------------------------
// Tests
//-------------------------------------------------
describe('Check OperationalError', () => {
    test('OperationalError is an instance of Error', () => {
        expect(new OperationalError_1.OperationalError('Whoops')).toBeInstanceOf(Error);
    });
    test('It has a name property', () => {
        const exampleError = new OperationalError_1.OperationalError('Whoops');
        expect(exampleError.name).toBe('OperationalError');
    });
    test('Sets a default message when left undefined', () => {
        const exampleError = new OperationalError_1.OperationalError();
        expect(typeof exampleError.message).toBe('string');
        expect(exampleError.message.length).toBeGreaterThan(0);
    });
    test('Applies a custom message', () => {
        const msg = 'Whoops';
        const exampleError = new OperationalError_1.OperationalError('Whoops');
        expect(exampleError.message).toBe(msg);
    });
    test('Has a statusCode property', () => {
        const exampleError = new OperationalError_1.OperationalError('Whoops');
        expect(exampleError.statusCode).toBe(500);
    });
});
//# sourceMappingURL=OperationalError.test.js.map