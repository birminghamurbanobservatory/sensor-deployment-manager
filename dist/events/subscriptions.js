"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const deployment_events_1 = require("../components/deployment/deployment.events");
async function invokeAllSubscriptions() {
    await deployment_events_1.subscribeToDeploymentEvents();
}
exports.invokeAllSubscriptions = invokeAllSubscriptions;
//# sourceMappingURL=subscriptions.js.map