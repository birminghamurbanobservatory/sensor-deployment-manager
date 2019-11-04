import {NotFound} from '../../../errors/NotFound';

export class PlatformNotFound extends NotFound {

  public constructor(message = 'Platform could not be found') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}