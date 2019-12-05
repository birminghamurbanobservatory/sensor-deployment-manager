import * as contextService from './context.service';
import {BadRequest} from '../../errors/BadRequest';
import * as joi from '@hapi/joi';
import {Observation} from './observation.class';
import {giveObsContext} from './context.helpers';


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
      // If no context found, then just return the obs as it came in
      return obsWithoutContext;
    } else {
      throw err;
    }
  }

  const obsWithContext = giveObsContext(obsWithoutContext, context.toAdd);
  return obsWithContext;

}