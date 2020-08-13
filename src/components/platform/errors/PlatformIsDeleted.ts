import {NotFound} from '../../../errors/NotFound';

export class PlatformIsDeleted extends NotFound {

  public constructor(message = 'The platform no longer exists.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}