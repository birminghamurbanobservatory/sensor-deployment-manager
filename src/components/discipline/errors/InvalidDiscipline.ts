import {BadRequest} from '../../../errors/BadRequest';

export class InvalidDiscipline extends BadRequest {

  public constructor(message = 'Invalid discipline') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}