import {NotFound} from '../../../errors/NotFound';

export class FeatureOfInterestNotFound extends NotFound {

  public constructor(message = 'FeatureOfInterest could not be found') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}