"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const event = __importStar(require("event-stream"));
const deployment_controller_1 = require("./deployment.controller");
const logger = __importStar(require("node-logger"));
const bluebird_1 = require("bluebird");
const handle_event_handler_error_1 = require("../../events/handle-event-handler-error");
const joi = __importStar(require("@hapi/joi"));
const BadRequest_1 = require("../../errors/BadRequest");
async function subscribeToDeploymentEvents() {
    const subscriptionFunctions = [
        subscribeToDeploymentCreateRequests
    ];
    // I don't want later subscriptions to be prevented, just because an earlier attempt failed, as I want my event-stream module to have all the event names and handler functions added to its list of subscriptions so it can add them again upon a reconnect.
    await bluebird_1.Promise.mapSeries(subscriptionFunctions, async (subscriptionFunction) => {
        try {
            await subscriptionFunction();
        }
        catch (err) {
            if (err.name === 'NoEventStreamConnection') {
                // If it failed to subscribe because the event-stream connection isn't currently down, I still want it to continue adding the other subscriptions, so that the event-stream module has all the event names and handler functions added to its list of subscriptions so it can add them again upon a reconnect.
                logger.warn(`Failed to subscribe due to event-stream connection being down`);
            }
            else {
                throw err;
            }
        }
        return;
    });
    return;
}
exports.subscribeToDeploymentEvents = subscribeToDeploymentEvents;
//-------------------------------------------------
// Create Deployment
//-------------------------------------------------
async function subscribeToDeploymentCreateRequests() {
    const eventName = 'deployment.create.request';
    const deploymentCreateRequestSchema = joi.object({
        new: joi.object({
        // We'll let the deployment.service check this part
        })
            .unknown()
            .required()
    }).required();
    await event.subscribe(eventName, async (message) => {
        logger.debug(`New ${eventName} message.`, message);
        let createdDeployment;
        try {
            const { error: err } = deploymentCreateRequestSchema.validate(message);
            if (err)
                throw new BadRequest_1.BadRequest(`Invalid ${eventName} request: ${err.message}`);
            createdDeployment = await deployment_controller_1.createDeployment(message.new);
        }
        catch (err) {
            handle_event_handler_error_1.logCensorAndRethrow(eventName, err);
        }
        return createdDeployment;
    });
    logger.debug(`Subscribed to ${eventName} requests`);
    return;
}
//# sourceMappingURL=deployment.events.js.map