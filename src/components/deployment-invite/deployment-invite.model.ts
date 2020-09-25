//-------------------------------------------------
// Dependencies
//-------------------------------------------------
import * as mongoose from 'mongoose';
import {kebabCaseRegex} from '../../utils/regular-expressions';

//-------------------------------------------------
// Schema
//-------------------------------------------------
const schema = new mongoose.Schema({
  _id: {
    type: String, // this is a uuid
    required: true,
    immutable: true, // prevents this from being updated
    maxlength: [36, 'Deployment invite id is too long'],
  },
  deploymentId: {
    type: String, 
    required: true
  },
  deploymentLabel: {
    type: String, 
    required: true
  },
  expiresAt: {
    type: Date,
    required: false
  },
  level: {
    type: String,
    required: true,
    enum: ['admin', 'engineer', 'social', 'basic']
  }
}
);

//-------------------------------------------------
// Indexes
//-------------------------------------------------
// The following will delete invites once they have passed their expiration date.
schema.index({expiresAt: 1}, {expireAfterSeconds: 0}); 

//-------------------------------------------------
// Create Model (and expose it to our app)
//-------------------------------------------------
export default mongoose.model('DeploymentInvite', schema);