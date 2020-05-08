import {Conflict} from '../../../errors/Conflict';

export class UnitAlreadyExists extends Conflict {

  public constructor(message = 'Unit already exists') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}