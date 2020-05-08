import {Conflict} from '../../../errors/Conflict';

export class ProcedureAlreadyExists extends Conflict {

  public constructor(message = 'Procedure already exists') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}