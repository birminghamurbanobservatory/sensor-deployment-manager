import {NotFound} from '../../../errors/NotFound';

export class UnknownSensorNotFound extends NotFound {

  public constructor(message = 'Unknown sensor could not be found') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}