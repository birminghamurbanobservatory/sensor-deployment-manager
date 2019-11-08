import {Conflict} from '../../../errors/Conflict';

export class ContextAlreadyExists extends Conflict {

  public constructor(message = 'Context already exists') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}