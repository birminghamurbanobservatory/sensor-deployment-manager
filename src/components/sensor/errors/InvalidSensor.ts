import {BadRequest} from '../../../errors/BadRequest';

export class InvalidSensor extends BadRequest {

  public constructor(message = 'Invalid sensor') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}