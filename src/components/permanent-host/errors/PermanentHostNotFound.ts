import {NotFound} from '../../../errors/NotFound';

export class PermanentHostNotFound extends NotFound {

  public constructor(message = 'Permanent host could not be found') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}