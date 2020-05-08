import {Conflict} from '../../../errors/Conflict';

export class UsedProcedureAlreadyExists extends Conflict {

  public constructor(message = 'Used procedure already exists') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}