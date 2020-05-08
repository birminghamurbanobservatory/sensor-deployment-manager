import {BadRequest} from '../../../errors/BadRequest';

export class InvalidFeatureOfInterest extends BadRequest {

  public constructor(message = 'Invalid featureOfIinterest') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}