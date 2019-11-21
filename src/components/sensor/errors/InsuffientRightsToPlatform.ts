import {Forbidden} from '../../../errors/Forbidden';

export class InsufficientRightsToPlatform extends Forbidden {

  public constructor(message = 'You do not have sufficient rights to this platform.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}