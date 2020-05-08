import {BadRequest} from '../../../errors/BadRequest';

export class InvalidUsedProcedure extends BadRequest {

  public constructor(message = 'Invalid used procedure') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}