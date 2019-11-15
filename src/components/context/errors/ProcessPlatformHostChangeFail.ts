import {DatabaseError} from '../../../errors/DatabaseError';

export class ProcessPlatformHostChangeFail extends DatabaseError {

  public privateMessage: string;

  public constructor(message = 'Failed to update context in response to platform being rehosted.', privateMessage?: string) {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    // Add a private message, which can for logged for extra detail, but should not be sent to the client.
    this.privateMessage = privateMessage;    
  }

}