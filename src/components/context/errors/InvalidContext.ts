import {BadRequest} from '../../../errors/BadRequest';

export class InvalidContext extends BadRequest {

  public constructor(message = 'Invalid context') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}