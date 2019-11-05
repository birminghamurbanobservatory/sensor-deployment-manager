import {BadRequest} from '../../../errors/BadRequest';

export class InvalidPermanentHost extends BadRequest {

  public constructor(message = 'Invalid permanent host') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}