import * as contextService from './context.service';
import {BadRequest} from '../../errors/BadRequest';
import * as joi from '@hapi/joi';
import {ObservationApp} from '../observation/observation-app.class';
import {giveObsContext} from './context.helpers';
import * as logger from 'node-logger';
import {getPlatformsWithIds, updatePlatformsWithLocationObservation} from '../platform/platform.service';
import {cloneDeep} from 'lodash';
import {validateGeometry} from '../../utils/geojson-validator';
import {v4 as uuid} from 'uuid';
import {observationAppToClient, observationClientToApp} from '../observation/observation.service';
import {ObservationClient} from '../observation/observation-client.class';


const obsWithoutContextSchema = joi.object({
  // There's some properties that the observation must have in order to find the appropriate context
  madeBySensor: joi.string()
    .required(),
  resultTime: joi.string()
    .isoDate()
    .required()
})
.unknown()
.required();

// This function name may not be the best, given that it doesn't just add context, but it may also updates this applications records too (e.g. platform locations).
export async function addContextToObservation(observation: ObservationClient): Promise<ObservationClient> {

  const {error: validationError} = obsWithoutContextSchema.validate(observation);
  if (validationError) {
    throw new BadRequest(validationError.message);
  }

  const obsWithoutContext: ObservationApp = observationClientToApp(observation);

  // Find the appropriate context
  let context;
  try {
    context = await contextService.getContextForSensorAtTime(obsWithoutContext.madeBySensor, new Date(obsWithoutContext.resultTime));
  } catch (err) {
    if (err.name === 'ContextNotFound') {
      logger.debug('No context was found for this observation.');
    } else {
      throw err;
    }
  }

  let updatedObs;
  if (context) {
    updatedObs = giveObsContext(obsWithoutContext, context.toAdd);
  } else {
    updatedObs = cloneDeep(obsWithoutContext);
  }

  // Is this an observation of a location, e.g. from a gps sensor.
  const observesLocation = updatedObs.observedProperty === 'location';

  //------------------------
  // Non-location observations
  //------------------------
  if (!observesLocation) {

    // If the observation has no location, see if we can derive the location from its host platforms.
    // First get the platform documents of all this sensor's hosts
    // Find the most direct platform with a location, and use that.
    if (!updatedObs.location && updatedObs.hostedByPath) {
      logger.debug('Context includes a hostedByPath which will be used to add a possible location for the observation.', updatedObs.hostedByPath);
      const platforms = await getPlatformsWithIds(updatedObs.hostedByPath);
      // This keeps overwriting the location if more direct platforms have a location.
      updatedObs.hostedByPath.forEach((platformId) => {
        const matchingPlatform = platforms.find((platform) => platform.id === platformId);
        if (matchingPlatform && matchingPlatform.location) {
          updatedObs.location = matchingPlatform.location;
        } 
      });
      if (updatedObs.location) {
        logger.debug('A location was added to the observation.', updatedObs.location);
      }
    }

  //------------------------
  // Location observations
  //------------------------
  } else {

    // If it doesn't have a location object yet then add one. It's worth adding this now so that it's given an id thats stored in any platform locations that are updated, and will be passed on to be saved by the observations-manager.
    if (!updatedObs.location) {
      // Let's double check that the value is valid geometry
      validateGeometry(updatedObs.hasResult.value);
      updatedObs.location = {
        id: uuid(),
        validAt: new Date(updatedObs.resultTime),
        geometry: updatedObs.hasResult.value
      };        
    }

    // Are there any platforms that have their location updated by this sensor
    if (updatedObs.inDeployments && updatedObs.inDeployments.length > 0) {
      await updatePlatformsWithLocationObservation(updatedObs);
    }

  }

  const updatedObsForClient = observationAppToClient(updatedObs);
  return updatedObsForClient;

}