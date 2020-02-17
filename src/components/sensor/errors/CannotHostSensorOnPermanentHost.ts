import {Forbidden} from '../../../errors/Forbidden';

export class CannotHostSensorOnPermanentHost extends Forbidden {

  public constructor(message = 'The platform you are trying to host the sensor on was created from a permanent host, therefore it is not possible to host further sensors on it.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}