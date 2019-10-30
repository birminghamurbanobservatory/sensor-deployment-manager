"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const check = __importStar(require("check-types"));
const name_to_client_id_1 = require("../../utils/name-to-client-id");
const generate_client_id_suffix_1 = require("../../utils/generate-client-id-suffix");
const logger = __importStar(require("node-logger"));
const deploymentService = __importStar(require("./deployment.service"));
async function createDeployment(deployment) {
    // If the new deployment doesn't have an id yet, then we can autogenerate one.
    const idSpecified = check.assigned(deployment.id);
    if (!idSpecified) {
        deployment.id = name_to_client_id_1.nameToClientId(deployment.name);
        logger.debug(`The deployment name: '${deployment.name}' has been converted to an id of '${deployment.id}'`);
    }
    const deploymentToCreate = deploymentService.deploymentClientToApp(deployment);
    let createdDeployment;
    try {
        createdDeployment = await deploymentService.createDeployment(deploymentToCreate);
    }
    catch (err) {
        if (!idSpecified && err.name === 'DeploymentAlreadyExists') {
            // If the clientId we allocated has already been taken, then lets add a random string onto the end and try again.
            deploymentToCreate.id = `${deploymentToCreate.id}-${generate_client_id_suffix_1.generateClientIdSuffix()}`;
            createdDeployment = await deploymentService.createDeployment(deploymentToCreate);
        }
        else {
            throw err;
        }
    }
    logger.debug('New deployment created', createdDeployment);
    // TODO: We need to give the user admin rights to this deployment too. Use the deployment.createdBy field.
    return deploymentService.deploymentAppToClient(createdDeployment);
}
exports.createDeployment = createDeployment;
//# sourceMappingURL=deployment.controller.js.map