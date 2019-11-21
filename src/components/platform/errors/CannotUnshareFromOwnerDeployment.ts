import {Forbidden} from '../../../errors/Forbidden';

export class CannotUnshareFromOwnerDeployment extends Forbidden {

  public constructor(message = 'It is not possible to unshare a deployment from the deployment that owns it.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}