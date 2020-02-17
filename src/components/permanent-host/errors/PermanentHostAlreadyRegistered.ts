import {Forbidden} from '../../../errors/Forbidden';

export class PermanentHostAlreadyRegistered extends Forbidden {

  public constructor(message = 'Permanent host is already registered to a deployment.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}