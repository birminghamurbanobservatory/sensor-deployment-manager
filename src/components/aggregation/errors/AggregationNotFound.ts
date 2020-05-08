import {NotFound} from '../../../errors/NotFound';

export class AggregationNotFound extends NotFound {

  public constructor(message = 'Aggregation could not be found') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}