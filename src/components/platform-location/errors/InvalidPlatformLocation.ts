import {BadRequest} from '../../../errors/BadRequest';

export class InvalidPlatformLocation extends BadRequest {

  public constructor(message = 'Invalid platform location') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}