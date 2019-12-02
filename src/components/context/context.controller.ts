import * as contextService from './context.service';
import {BadRequest} from '../../errors/BadRequest';
import * as joi from '@hapi/joi';


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
  const context = contextService.getContextForSensorAtTime(obsWithoutContext.madeBySensor, new Date(obsWithoutContext.resultTime));

  // TODO: If no context found, just return the obs as it came in?

  // TODO


}