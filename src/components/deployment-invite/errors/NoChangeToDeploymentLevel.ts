import {Forbidden} from '../../../errors/Forbidden';

export class NoChangeToDeploymentLevel extends Forbidden {

  public constructor(message = 'You already have this level of access to the deployment.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}