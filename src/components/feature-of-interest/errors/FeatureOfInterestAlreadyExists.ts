import {Conflict} from '../../../errors/Conflict';

export class FeatureOfInterestAlreadyExists extends Conflict {

  public constructor(message = 'FeatureOfInterest already exists') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain   
  }

}