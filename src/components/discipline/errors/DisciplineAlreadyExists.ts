import {Conflict} from '../../../errors/Conflict';

export class DisciplineAlreadyExists extends Conflict {

  public constructor(message = 'Discipline already exists') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}