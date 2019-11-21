import {Forbidden} from '../../../errors/Forbidden';

export class PlatformAlreadyInDeployment extends Forbidden {

  public constructor(message = 'The platform cannot be shared with a deployment it is already in.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}