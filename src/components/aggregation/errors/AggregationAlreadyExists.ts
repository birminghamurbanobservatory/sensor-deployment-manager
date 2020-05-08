import {Conflict} from '../../../errors/Conflict';

export class AggregationAlreadyExists extends Conflict {

  public constructor(message = 'Aggregation already exists') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}