
import {Forbidden} from '../../../errors/Forbidden';

export class SensorsRemainOnPermanentHost extends Forbidden {

  public constructor(message = 'Sensors still remain on the permanent host') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}