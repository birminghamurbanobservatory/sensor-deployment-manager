import {Conflict} from '../../../errors/Conflict';

export class PlatformAlreadyExists extends Conflict {

  public constructor(message: string = 'Platform already exists') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}