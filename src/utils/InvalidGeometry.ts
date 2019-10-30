import {BadRequest} from '../errors/BadRequest';

export class InvalidGeometry extends BadRequest {

  public constructor(message: string = 'Invalid GeoJSON') {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  }

}