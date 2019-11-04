import {NotFound} from '../../../errors/NotFound';

export class PlatformLocationNotFound extends NotFound {

  public constructor(message = 'A location for this platform could not be found') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}