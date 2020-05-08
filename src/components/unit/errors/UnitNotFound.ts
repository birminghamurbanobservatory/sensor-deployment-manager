import {NotFound} from '../../../errors/NotFound';

export class UnitNotFound extends NotFound {

  public constructor(message = 'Unit could not be found') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}