import {NotFound} from '../../../errors/NotFound';

export class DeploymentInviteNotFound extends NotFound {

  public constructor(message = 'Deployment invite could not be found') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}