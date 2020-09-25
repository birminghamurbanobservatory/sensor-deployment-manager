import {BadRequest} from '../../../errors/BadRequest';

export class InvalidDeploymentInvite extends BadRequest {

  public constructor(message = 'Invalid deployment invite') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}