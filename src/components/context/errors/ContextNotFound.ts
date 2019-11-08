import {NotFound} from '../../../errors/NotFound';

export class ContextNotFound extends NotFound {

  public constructor(message = 'Context could not be found') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}