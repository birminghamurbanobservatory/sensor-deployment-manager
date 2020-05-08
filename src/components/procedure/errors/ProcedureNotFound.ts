import {NotFound} from '../../../errors/NotFound';

export class ProcedureNotFound extends NotFound {

  public constructor(message = 'Procedure could not be found') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}