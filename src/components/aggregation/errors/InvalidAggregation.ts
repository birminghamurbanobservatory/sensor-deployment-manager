import {BadRequest} from '../../../errors/BadRequest';

export class InvalidAggregation extends BadRequest {

  public constructor(message = 'Invalid aggregation') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}