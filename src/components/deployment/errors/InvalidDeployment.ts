import {BadRequest} from '../../../errors/BadRequest';

export class InvalidDeployment extends BadRequest {

  public constructor(message = 'Invalid deployment') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}