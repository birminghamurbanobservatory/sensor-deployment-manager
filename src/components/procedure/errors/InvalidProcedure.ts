import {BadRequest} from '../../../errors/BadRequest';

export class InvalidProcedure extends BadRequest {

  public constructor(message = 'Invalid procedure') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}