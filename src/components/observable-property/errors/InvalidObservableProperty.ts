import {BadRequest} from '../../../errors/BadRequest';

export class InvalidObservableProperty extends BadRequest {

  public constructor(message = 'Invalid observableProperty') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}