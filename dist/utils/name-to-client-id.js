"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function nameToClientId(name) {
    const lowercased = name.toLowerCase();
    const noSpaces = lowercased.replace(/\s+/g, '-');
    const urlSafe = noSpaces.replace(/[^a-z0-9-]/g, '');
    const clientId = urlSafe;
    return clientId;
}
exports.nameToClientId = nameToClientId;
//# sourceMappingURL=name-to-client-id.js.map