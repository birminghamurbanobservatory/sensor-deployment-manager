"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BadRequest_1 = require("./BadRequest");
const OperationalError_1 = require("./OperationalError");
//-------------------------------------------------
// Tests
//-------------------------------------------------
describe('Check BadRequest', () => {
    test('Is an instance of Error', () => {
        expect(new BadRequest_1.BadRequest('Whoops')).toBeInstanceOf(Error);
    });
    test('Is an instance of OperationalError', () => {
        expect(new BadRequest_1.BadRequest('Whoops')).toBeInstanceOf(OperationalError_1.OperationalError);
    });
    test('It has the correct name property', () => {
        const exampleError = new BadRequest_1.BadRequest('Whoops');
        expect(exampleError.name).toBe('BadRequest');
    });
    test('Has the correct statusCode', () => {
        const exampleError = new BadRequest_1.BadRequest('Whoops');
        expect(exampleError.statusCode).toBe(400);
    });
    test('Sets a default message when left undefined', () => {
        const exampleError = new BadRequest_1.BadRequest();
        expect(typeof exampleError.message).toBe('string');
        expect(exampleError.message.length).toBeGreaterThan(0);
    });
    test('Applies a custom message', () => {
        const msg = 'Whoops';
        const exampleError = new BadRequest_1.BadRequest(msg);
        expect(exampleError.message).toBe(msg);
    });
});
//# sourceMappingURL=BadRequest.test.js.map