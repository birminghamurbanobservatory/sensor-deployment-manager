import {BadRequest} from '../../../errors/BadRequest';

export class InvalidDeploymentUpdates extends BadRequest {

  public constructor(message: string = 'Invalid updates to deployment') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}