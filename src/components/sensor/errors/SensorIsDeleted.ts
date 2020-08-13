import {NotFound} from '../../../errors/NotFound';

export class SensorIsDeleted extends NotFound {

  public constructor(message = 'The sensor no longer exists.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}