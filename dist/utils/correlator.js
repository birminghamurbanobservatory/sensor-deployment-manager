"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const cls = __importStar(require("cls-hooked"));
const shortId = __importStar(require("shortid"));
// Based on: https://medium.com/@evgeni.kisel/add-correlation-id-in-node-js-applications-fde759eed5e3
const store = cls.createNamespace(`correlation-id-namespace`);
const CORRELATION_ID_KEY = `correlation-id`;
// executes specified function with correlation ID. If ID is missing then new ID is generated
async function withCorrelationId(fn, id) {
    return store.runAndReturn(() => {
        setCorrelationId(id);
        return fn();
    });
}
exports.withCorrelationId = withCorrelationId;
function setCorrelationId(id) {
    store.set(CORRELATION_ID_KEY, id || shortId.generate());
    return;
}
function getCorrelationId() {
    return store.get(CORRELATION_ID_KEY);
}
exports.getCorrelationId = getCorrelationId;
exports.bindEmitter = store.bindEmitter.bind(store);
exports.bind = store.bind.bind(store);
//# sourceMappingURL=correlator.js.map