import * as contextService from './context.service';
import {BadRequest} from '../../errors/BadRequest';
import * as joi from '@hapi/joi';
import {Observation} from './observation.class';
import {giveObsContext} from './context.helpers';
import * as logger from 'node-logger';
import {getPlatformsWithIds} from '../platform/platform.service';
import {cloneDeep} from 'lodash';


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

export async function addContextToObservation(obsWithoutContext: Observation): Promise<Observation> {

  const {error: validationError} = obsWithoutContextSchema.validate(obsWithoutContext);
  if (validationError) {
    throw new BadRequest(validationError.message);
  }

  // Find the appropriate context
  let context;
  try {
    context = await contextService.getContextForSensorAtTime(obsWithoutContext.madeBySensor, new Date(obsWithoutContext.resultTime));
  } catch (err) {
    if (err.name === 'ContextNotFound') {
      logger.debug('No context was found for this observation, returning observation as it came in.');
      // If no context found, then just return the obs as it came in
      return obsWithoutContext;
    } else {
      throw err;
    }
  }

  const obsWithContext = giveObsContext(obsWithoutContext, context.toAdd);

  // If the observation has no location, see if we can derive the location from its host platforms.
  // First get the platform documents of all this sensor's hosts
  // Find the most direct platform with a location, and use that.
  if (!obsWithContext.location && obsWithContext.hostedByPath) {
    logger.debug('Context includes a hostedByPath which will be used to add a possible location for the observation.', obsWithContext.hostedByPath);
    const platforms = await getPlatformsWithIds(obsWithContext.hostedByPath);
    // This keeps overwriting the location if more direct platforms have a location.
    obsWithContext.hostedByPath.forEach((platformId) => {
      const matchingPlatform = platforms.find((platform) => platform.id === platformId);
      if (matchingPlatform && matchingPlatform.location) {
        obsWithContext.location = matchingPlatform.location;
      } 
    });
    if (obsWithContext.location) {
      logger.debug('A location was added to the observation.', obsWithContext.location);
    }
  }

  // TODO: If the observation is from a gps sensor then search for platforms with a matching 'updateLocationWithSensor' property, and if this observation is newer then update the location.

  return obsWithContext;

}