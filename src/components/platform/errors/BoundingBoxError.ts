import {BadRequest} from '../../../errors/BadRequest';

export class InvalidPlatform extends BadRequest {

  public constructor(message = 'Invalid bounding box') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}