import {NotFound} from '../../../errors/NotFound';

export class PermanentHostIsDeleted extends NotFound {

  public constructor(message = 'The permanent host no longer exists.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}