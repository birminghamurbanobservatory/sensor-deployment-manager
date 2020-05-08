import {NotFound} from '../../../errors/NotFound';

export class DisciplineNotFound extends NotFound {

  public constructor(message = 'Discipline could not be found') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}