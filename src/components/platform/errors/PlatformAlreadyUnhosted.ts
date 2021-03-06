import {Forbidden} from '../../../errors/Forbidden';

export class PlatformAlreadyUnhosted extends Forbidden {

  public constructor(message = 'The platform is already unhosted.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}