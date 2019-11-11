import {Conflict} from '../../../errors/Conflict';

export class SensorAlreadyExists extends Conflict {

  public constructor(message = 'Sensor already exists') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}