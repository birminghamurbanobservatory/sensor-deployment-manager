import {BadRequest} from '../../../errors/BadRequest';

export class InvalidUnit extends BadRequest {

  public constructor(message = 'Invalid unit') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}