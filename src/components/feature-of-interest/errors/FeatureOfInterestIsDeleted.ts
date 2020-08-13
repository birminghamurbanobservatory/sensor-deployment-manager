import {NotFound} from '../../../errors/NotFound';

export class FeatureOfInterestIsDeleted extends NotFound {

  public constructor(message = 'The feature of interest no longer exists.') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}