import {NotFound} from '../../../errors/NotFound';

export class ObservablePropertyNotFound extends NotFound {

  public constructor(message = 'ObservableProperty could not be found') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}