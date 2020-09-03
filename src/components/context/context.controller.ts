import * as contextService from './context.service';
import {BadRequest} from '../../errors/BadRequest';
import * as joi from '@hapi/joi';
import {ObservationApp} from '../observation/observation-app.class';
import {giveObsContext} from './context.helpers';
import * as logger from 'node-logger';
import {getPlatformsWithIds, updatePlatformsWithLocationObservation} from '../platform/platform.service';
import {cloneDeep, last} from 'lodash';
import {validateGeometry} from '../../utils/geojson-validator';
import {v4 as uuid} from 'uuid';
import {observationAppToClient, observationClientToApp} from '../observation/observation.service';
import {ObservationClient} from '../observation/observation-client.class';
import {upsertUnknownSensor} from '../unknown-sensor/unknown-sensor.service';
import {getSensor} from '../sensor/sensor.service';
import * as check from 'check-types';


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

  const arrivedWithALocation = check.assigned(observation.location);

  const obsWithoutContext: ObservationApp = observationClientToApp(observation);

  // Find the appropriate context
  let context;
  try {
    // TODO: Use populate (https://mongoosejs.com/docs/populate.html) to get any platforms listed in the context at the same time, this way we can also get the passLocationToObservations or updateLocationWithSensor settings in the same request.
    context = await contextService.getContextForSensorAtTime(obsWithoutContext.madeBySensor, new Date(obsWithoutContext.resultTime), {populatePlatforms: true});
  } catch (err) {
    if (err.name === 'ContextNotFound') {

      logger.debug('No context was found for this observation.');
      // If no context is found, then it's either because we have no record of this sensor, or because the resultTime is outside of the contexts's start and end dates. If it's the case that the sensor is completely unknown then lets keep a record of this unknown sensor.
      let sensorIsUnknown;
      try {
        await getSensor(observation.madeBySensor);
      } catch (err) {
        if (err.name === 'SensorNotFound') {
          // N.B. at present this won't be reach when a SensorIsDeleted error is throw. Which I think is what I want.
          sensorIsUnknown = true;
        } else {
          throw err;
        }
      }

      if (sensorIsUnknown) {
        logger.debug(`Upserting unknown sensor (sensor id: ${observation.madeBySensor})`);
        const unknownSensor = {
          id: observation.madeBySensor,
          lastObservation: observation
        };
        await upsertUnknownSensor(unknownSensor);
      }

    } else {
      throw err;
    }
  }

  let updatedObs;
  if (context) {
    updatedObs = giveObsContext(obsWithoutContext, context);
  } else {
    updatedObs = cloneDeep(obsWithoutContext);
  }

  // Chances are if I'm getting data from GPS sensors then the ingestor will add the location to the 'location' property, and not just have it as the value, but just in case it doesn't let's use the code below to make sure the 'location' property is added. It's worth adding this now so that it's given an id that's stored in any platform locations that are updated, and will be passed on to be saved by the observations-manager.
  if (updatedObs.observedProperty === 'location' && !updatedObs.location) {
    // Let's double check that the value is valid geometry
    validateGeometry(updatedObs.hasResult.value);
    updatedObs.location = {
      id: uuid(),
      validAt: new Date(updatedObs.resultTime),
      geometry: updatedObs.hasResult.value
    };
  }

  // Are there any platforms waiting to have their location updated with this observation's location
  if (arrivedWithALocation && updatedObs.hasDeployment) {
    await updatePlatformsWithLocationObservation(updatedObs);
  }

  // Check to see if the observation should inherit the location of its platform
  if (context.hostedByPath && context.hostedByPath.length && check.object(context.hostedByPath[0])) {
    const bottomPlatform: any = last(context.hostedByPath);
    // Only pass the location to the observation if the most direct (bottommost) platform has passLocationToObservations set to true.
    const shouldPassLocation = bottomPlatform.passLocationToObservations;
    // Also don't do this if this platform has its location updated by this particular sensor, otherwise we'll end up overwriting the new location with the previous one.
    const sensorUpdatesBottomPlatformLocation = bottomPlatform.updateLocationWithSensor !== observation.madeBySensor;
    // Nor should we overwrite location observations, i.e. an observation with observed-property='location'.
    const isLocationObservation = observation.observedProperty === 'location';
    if (shouldPassLocation && !sensorUpdatesBottomPlatformLocation && !isLocationObservation) {
      if (bottomPlatform.location) {
        observation.location = bottomPlatform.location;
      } else {
        // Decided that if the user has set observations to inherit their platform's location, and that platform does not have a location then we should delete an location the platform may already have.
        delete observation.location;
      }
    }
  }

  const updatedObsForClient = observationAppToClient(updatedObs);
  return updatedObsForClient;

}