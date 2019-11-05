import {Conflict} from '../../../errors/Conflict';

export class PermanentHostAlreadyExists extends Conflict {

  public constructor(message = 'Platform already exists') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}