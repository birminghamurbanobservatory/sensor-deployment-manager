"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DatabaseError_1 = require("./DatabaseError");
const OperationalError_1 = require("./OperationalError");
//-------------------------------------------------
// Tests
//-------------------------------------------------
describe('Check DatabaseError', () => {
    test('DatabaseError is an instance of Error', () => {
        expect(new DatabaseError_1.DatabaseError('Whoops')).toBeInstanceOf(Error);
    });
    test('DatabaseError is an instance of OperationalError', () => {
        expect(new DatabaseError_1.DatabaseError('Whoops')).toBeInstanceOf(OperationalError_1.OperationalError);
    });
    test('It has the correct name property', () => {
        const exampleError = new DatabaseError_1.DatabaseError('Whoops');
        expect(exampleError.name).toBe('DatabaseError');
    });
    test('Has the correct statusCode', () => {
        const exampleError = new DatabaseError_1.DatabaseError('Whoops');
        expect(exampleError.statusCode).toBe(500);
    });
    test('Sets a default message when left undefined', () => {
        const exampleError = new DatabaseError_1.DatabaseError();
        expect(typeof exampleError.message).toBe('string');
        expect(exampleError.message.length).toBeGreaterThan(0);
    });
    test('Applies a custom message', () => {
        const msg = 'Whoops';
        const exampleError = new DatabaseError_1.DatabaseError(msg);
        expect(exampleError.message).toBe(msg);
    });
    test('DatabaseError can be passed a private message', () => {
        const msg = 'Whoops';
        const privateMessage = 'This was a big whoops, do not tell the client this.';
        const exampleError = new DatabaseError_1.DatabaseError(msg, privateMessage);
        expect(exampleError.privateMessage).toBe(privateMessage);
    });
});
//# sourceMappingURL=DatabaseError.test.js.map