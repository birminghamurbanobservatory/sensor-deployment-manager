import {NotFound} from '../../../errors/NotFound';

export class DeploymentNotFound extends NotFound {

  public constructor(message: string = 'Deployment could not be found') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}