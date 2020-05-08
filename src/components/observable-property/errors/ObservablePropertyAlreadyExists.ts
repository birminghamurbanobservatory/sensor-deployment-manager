import {Conflict} from '../../../errors/Conflict';

export class ObservablePropertyAlreadyExists extends Conflict {

  public constructor(message = 'ObservableProperty already exists') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}