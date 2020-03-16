import * as unknownSensorService from './unknown-sensor.service';
import {UnknownSensorClient} from './unknown-sensor-client.class';
import {PaginationOptions} from '../common/pagination-options.class';
import * as joi from '@hapi/joi';
import {BadRequest} from '../../errors/BadRequest';


const getUnknownSensorsOptionSchema = joi.object({
  limit: joi.number().integer().positive().max(1000).default(100),
  offset: joi.number().integer().positive().default(0),
  sortBy: joi.string().default('id'),
  sortOrder: joi.string().valid('asc', 'desc').default('asc')
}).default({
  limit: 100,
  offset: 0,
  sortBy: 'id',
  sortOrder: 'asc'
});

export async function getUnknownSensors(options?: PaginationOptions): Promise<{data: UnknownSensorClient[]; meta: any}> {

  const {error: err, value: validOptions} = getUnknownSensorsOptionSchema.validate(options);
  if (err) throw new BadRequest(`Invalid options: ${err.message}`);

  const results = await unknownSensorService.getUnknownSensors(validOptions);
  const unknownSensorsForClient = results.data.map(unknownSensorService.unknownSensorAppToClient);
  return {
    data: unknownSensorsForClient,
    meta: {
      totalCount: results.totalCount
      // TODO: Add next and prev links too.
    }
  };

}