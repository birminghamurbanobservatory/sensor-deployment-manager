import {NotFound} from '../../../errors/NotFound';

export class ObservablePropertyIsDeleted extends NotFound {

  public constructor(message = 'The observable property no longer exists.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}