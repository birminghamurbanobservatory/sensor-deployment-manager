"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const InvalidDeployment_1 = require("./errors/InvalidDeployment");
const CreateDeploymentFail_1 = require("./errors/CreateDeploymentFail");
const DeploymentAlreadyExists_1 = require("./errors/DeploymentAlreadyExists");
const deployment_model_1 = __importDefault(require("./deployment.model"));
const lodash_1 = require("lodash");
async function createDeployment(deployment) {
    const deploymentDb = deploymentAppToDb(deployment);
    let createdDeployment;
    try {
        createdDeployment = await deployment_model_1.default.create(deploymentDb);
    }
    catch (err) {
        if (err.name === 'MongoError' && err.code === 11000) {
            throw new DeploymentAlreadyExists_1.DeploymentAlreadyExists(`A deployment with an id of ${deployment.id} already exists.`);
            // TODO: Check this works
        }
        else if (err.name === 'ValidationError') {
            throw new InvalidDeployment_1.InvalidDeployment(err.message);
        }
        else {
            throw new CreateDeploymentFail_1.CreateDeploymentFail(undefined, err.message);
        }
    }
    return deploymentDbToApp(createdDeployment);
}
exports.createDeployment = createDeployment;
function deploymentAppToDb(deploymentApp) {
    const deploymentDb = lodash_1.cloneDeep(deploymentApp);
    deploymentDb._id = deploymentApp.id;
    delete deploymentDb.id;
    return deploymentDb;
}
function deploymentDbToApp(deploymentDb) {
    const deploymentApp = lodash_1.cloneDeep(deploymentDb);
    deploymentApp.id = deploymentApp._id;
    delete deploymentApp._id;
    return deploymentApp;
}
function deploymentAppToClient(deploymentApp) {
    const deploymentClient = lodash_1.cloneDeep(deploymentApp);
    return deploymentClient;
}
exports.deploymentAppToClient = deploymentAppToClient;
function deploymentClientToApp(deploymentClient) {
    const deploymentApp = lodash_1.cloneDeep(deploymentClient);
    return deploymentApp;
}
exports.deploymentClientToApp = deploymentClientToApp;
//# sourceMappingURL=deployment.service.js.map