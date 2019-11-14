import {Forbidden} from '../../../errors/Forbidden';

export class HostPlatformInPrivateDeployment extends Forbidden {

  public constructor(message = 'The host platform is in a private deployment.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}