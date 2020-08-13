import {NotFound} from '../../../errors/NotFound';

export class DeploymentIsDeleted extends NotFound {

  public constructor(message = 'The deployment no longer exists.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}