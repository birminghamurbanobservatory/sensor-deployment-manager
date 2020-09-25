import {Forbidden} from '../../../errors/Forbidden';

export class CannotDowngradeDeploymentLevel extends Forbidden {

  public constructor(message = 'Cannot downgrade deployment access level.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}