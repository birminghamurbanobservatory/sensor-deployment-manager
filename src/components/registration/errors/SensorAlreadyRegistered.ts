import {Forbidden} from '../../../errors/Forbidden';

export class SensorAlreadyRegistered extends Forbidden {

  public constructor(message = 'Sensor is already registered to another deployment.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}