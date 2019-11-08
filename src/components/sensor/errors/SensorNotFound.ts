import {NotFound} from '../../../errors/NotFound';

export class SensorNotFound extends NotFound {

  public constructor(message = 'Sensor could not be found') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}