
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
    type: String,
    required: true,
    immutable: true, // prevents this from being updated
    maxlength: [44, 'Permanent host id is too long'],
    validate: {
      validator: (value): boolean => {
        return kebabCaseRegex.test(value);
      },
      message: (props): string => {
        return `Permanent host id must be kebab case. ${props.value} is not.`;
      }
    }
  },
  name: {
    type: String, 
    required: true,
    maxlength: [40, 'Permanent host name is too long']
  },
  description: {
    type: String,
    maxlength: [1000, 'Permanent host description is too long'],
    default: ''
  },
  static: {
    type: Boolean,
    default: false // as I imagine most are able to be moved around.
  },
  updateLocationWithSensor: String, // so platforms can inherit this when generated
  registrationKey: {
    type: String,
    required: true,
    validate: {
      validator: (value): boolean => {
        return value.length === 10;
      },
      message: (props): string => {
        return `Permanent host registration key must be 10 characters long.`;
      }
    }
  },
  registeredAs: {
    type: String, // the platform ID initialised from this permamentHost and to which the sensors are currently hosted by.
  },
  // for soft deletes
  deletedAt: { 
    type: Date
  }
}, {
  timestamps: true // automatically adds createdAt and updatedAt fields
});


//-------------------------------------------------
// Indexes
//-------------------------------------------------
schema.index({registrationKey: 1}, {unique: true});
schema.index({_id: 'text', name: 'text'});

//-------------------------------------------------
// Create Model (and expose it to our app)
//-------------------------------------------------
export default mongoose.model('PermanentHost', schema);