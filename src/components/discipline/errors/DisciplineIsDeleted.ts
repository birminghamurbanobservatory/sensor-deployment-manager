import {NotFound} from '../../../errors/NotFound';

export class DisciplineIsDeleted extends NotFound {

  public constructor(message = 'The discipline no longer exists.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}