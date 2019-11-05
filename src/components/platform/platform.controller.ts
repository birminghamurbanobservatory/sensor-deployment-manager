import {PlatformClient} from './platform-client.class';
import * as deploymentService from '../deployment/deployment.service';
import * as platformService from '../platform/platform.service';
import * as platformLocationService from '../platform-location/platform-location.service';
import {InvalidPlatform} from './errors/InvalidPlatform';
import * as check from 'check-types';
import {PlatformApp} from './platform-app.class';
import {PlatformNotFound} from './errors/PlatformNotFound';
import * as logger from 'node-logger';
import {nameToClientId} from '../../utils/name-to-client-id';
import {cloneDeep} from 'lodash';
import {generateClientIdSuffix} from '../../utils/generate-client-id-suffix';
import {PlatformLocationApp} from '../platform-location/platform-location-app.class';



export async function createPlatform(platform: PlatformClient): Promise<PlatformClient> {

  const hostPlatformSpecified = check.assigned(platform.isHostedBy);
  const locationSpecified = check.assigned(platform.location);
  const idSpecified = check.assigned(platform.id);

  // Check the deployment exists
  if (check.nonEmptyString(platform.ownerDeployment)) {
    // These get functions will throw an error if the resource doesn't exists, which is what we want.
    await deploymentService.getDeployment(platform.ownerDeployment);
  } else {
    throw new InvalidPlatform(`The platform property 'ownerDeployment' must be a non-empty string`);
  }

  // Check the host platform exists
  let hostPlatform: PlatformApp;
  if (hostPlatformSpecified) {
    try {
      hostPlatform = await platformService.getPlatform(platform.isHostedBy);
    } catch (err) {
      if (err.name === 'PlatformNotFound') {
        throw new PlatformNotFound(`Could not find the platform '${platform.isHostedBy}' provided as the 'isHostedBy' property.`);
      } else {
        throw err;
      }
    }

    // TODO: For now we'll just enforce that the new platorm needs to be in the same deployment as the host platform. But in the future we might want to allow it to be hosted on a platform in a public network, or in a deployment that the user also has sufficient rights to.
    if (!(hostPlatform.inDeployments.includes(platform.ownerDeployment))) {
      throw new InvalidPlatform(`The platform you wish to create has the deployment ${platform.ownerDeployment}, however the platform you wish to host it on is not associated with this deployment.`);
    }
  
    // Enforce the rule that a static platform can't be hosted a mobile platform
    if (hostPlatform.static === false && platform.static === true) {
      throw new InvalidPlatform('A static platform cannot be hosted by a mobile platform.');
    }

    logger.debug('Host Platform', hostPlatform);
  }

  const platformToCreate = cloneDeep(platform);
  delete platformToCreate.location;
  platformToCreate.inDeployments = [platformToCreate.ownerDeployment];
  if (!idSpecified) {
    platformToCreate.id = nameToClientId(platformToCreate.name);
    logger.debug(`The platform name: '${platform.name}' has been converted to an id of '${platformToCreate.id}'`);
  }

  let createdPlatform: PlatformApp;
  try {
    createdPlatform = await platformService.createPlatform(platformToCreate);
  } catch (err) {
    // If we generated an id from the name and this id is already taken then add a suffix and try again.
    if (!idSpecified && err.name === 'PlatformAlreadyExists') {
      platformToCreate.id = `${platformToCreate.id}-${generateClientIdSuffix()}`;
      createdPlatform = await platformService.createPlatform(platformToCreate);
    } else {
      throw err;
    }
  }

  logger.debug('New platform created', createdPlatform);

  // Add a new platform location
  let locationToAdd;

  if (locationSpecified) {
    locationToAdd = platform.location;
  } else if (hostPlatformSpecified) {
    // Get the current location of the host platform
    try {
      const hostPlatformLocation = await platformLocationService.getCurrentPlatformLocation(hostPlatform.id);
      locationToAdd = hostPlatformLocation.location;
    } catch (err) {
      if (err.name === 'PlatformLocationNotFound') {
        logger.debug(`Host platform '${hostPlatform.id}' does not have a current location, thus the new platform '${platform.name}' won't inherit its location`);
      } else {
        throw err;
      }      
    }
  }

  let newPlatformLocation;
  if (locationToAdd) {
    newPlatformLocation = await platformLocationService.createPlatformLocation({
      platform: createdPlatform.id,
      startDate: new Date(),
      location: locationToAdd
    });
    createdPlatform.location = newPlatformLocation.location;
    // TODO: Should we delete the platform document if we failed to create a platform location?
  }

  return platformService.platformAppToClient(createdPlatform);

}



export async function getPlatform(id: string, options?: {includeCurrentLocation}): Promise<any> {
  
  const platform: PlatformApp = await platformService.getPlatform(id);
  const platformLocation: PlatformLocationApp = await platformLocationService.getCurrentPlatformLocation(id);
  platform.location = platformLocation.location;
  return platformService.platformAppToClient(platform);

}


export async function getPlatforms(where: {inDeployment?: string}, options?: {includeCurrentLocation: boolean}): Promise<PlatformClient[]> {

  let platforms: PlatformApp[] = await platformService.getPlatforms(where);
  logger.debug('Platforms found', platforms);

  logger.debug('options', options);

  if (options && options.includeCurrentLocation) {
    // Get the current location of each of these platforms
    const platformIds = platforms.map((platform): string => platform.id);
    const currentLocations = await platformLocationService.getCurrentPlatformLocations(platformIds);
    logger.debug('Found current platform locations', currentLocations);
    platforms = platformService.mergePlatformsWithPlatformLocations(platforms, currentLocations);
  }

  return platforms.map(platformService.platformAppToClient);

}


export async function deletePlatform(id: string): Promise<void> {

  // Delete the platform
  // await platformService.deletePlatform(id);

  // Update any timeseries corresponding to this platform

  // Update any platforms that are hosted on this platform

  // a) If the platform was generated from a permanentHost, i.e. there are sensors physically attached to it, then you'll also need to unlink all the sensors from this deployment. 
  // b) If the platform was wasn't generated from a permanentHost, i.e. the user created it from scratch, then any sensors bound to it should still remain within the deployment.

  // An an endDate to its platform location?

  return;

}