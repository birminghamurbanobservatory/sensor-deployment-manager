import {DatabaseError} from '../../../errors/DatabaseError';

export class RemoveSensorFromAnyMatchingUpdateLocationWithSensorFail extends DatabaseError {

  public privateMessage: string;

  public constructor(message = 'Failed to remove sensor from platforms that had it listed as their updateLocationWithSensor property.', privateMessage?: string) {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    // Add a private message, which can for logged for extra detail, but should not be sent to the client.
    this.privateMessage = privateMessage;    
  }

}