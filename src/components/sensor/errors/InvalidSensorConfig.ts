import {BadRequest} from '../../../errors/BadRequest';

export class InvalidSensorConfig extends BadRequest {

  public constructor(message = 'Invalid sensor config object') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}