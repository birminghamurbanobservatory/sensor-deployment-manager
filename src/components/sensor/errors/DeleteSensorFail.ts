import {DatabaseError} from '../../../errors/DatabaseError';

export class DeleteSensorFail extends DatabaseError {

  public privateMessage: string;

  public constructor(message = 'Failed to delete sensor.', privateMessage?: string) {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    // Add a private message, which can for logged for extra detail, but should not be sent to the client.
    this.privateMessage = privateMessage;    
  }

}