import {Forbidden} from '../../../errors/Forbidden';

export class PlatformNotSharedWithDeployment extends Forbidden {

  public constructor(message = 'The platform is not shared with the deployment and therefore cannot be unshared from it.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}