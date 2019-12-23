import {NotFound} from '../../../errors/NotFound';

export class DeploymentUserNotFound extends NotFound {

  public constructor(message = 'Deployment user could not be found') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}