import {Forbidden} from '../../../errors/Forbidden';

export class CannotHostSensorWithPermanentHost extends Forbidden {

  public constructor(message = 'This sensor you are trying to host has a permanent host and thus cannot be directly hosted on another platform.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}