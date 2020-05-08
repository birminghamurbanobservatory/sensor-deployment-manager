import {NotFound} from '../../../errors/NotFound';

export class UsedProcedureNotFound extends NotFound {

  public constructor(message = 'Used procedure could not be found') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}