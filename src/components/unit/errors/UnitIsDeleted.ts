import {NotFound} from '../../../errors/NotFound';

export class UnitIsDeleted extends NotFound {

  public constructor(message = 'The unit no longer exists.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}