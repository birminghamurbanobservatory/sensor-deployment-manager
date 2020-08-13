import {NotFound} from '../../../errors/NotFound';

export class ProcedureIsDeleted extends NotFound {

  public constructor(message = 'The procedure no longer exists.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}