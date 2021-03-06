import {Conflict} from '../../../errors/Conflict';

export class DeploymentAlreadyExists extends Conflict {

  public constructor(message = 'Deployment already exists') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}