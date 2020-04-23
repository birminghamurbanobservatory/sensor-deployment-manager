//-------------------------------------------------
// Dependencies
//-------------------------------------------------
import * as mongoose from 'mongoose';
import {kebabCaseRegex} from '../../utils/regular-expressions';


//-------------------------------------------------
// Schema
//-------------------------------------------------
const userSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  level: {
    type: String,
    required: true,
    enum: ['admin', 'engineer', 'social', 'basic']
  }
});

const schema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    immutable: true, // prevents this from being updated
    maxlength: [44, 'Deployment id is too long'],
    validate: {
      validator: (value): boolean => {
        return kebabCaseRegex.test(value);
      },
      message: (props): string => {
        return `Deployment id must be kebab case. ${props.value} is not.`;
      }
    }
  },
  name: {
    type: String, 
    required: true,
    maxlength: [40, 'Deployment name is too long']
  },
  description: {
    type: String,
    maxlength: [1000, 'Deployment description is too long'],
    default: ''
  },
  public: {
    type: Boolean,
    default: false
  },
  users: {
    type: [userSchema],
    default: []
  },
  createdBy: {
    type: String,
    immutable: true,
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
schema.index({'users.id': 1});
schema.index({public: 1});
schema.index({_id: 'text', name: 'text'});


//-------------------------------------------------
// Create Model (and expose it to our app)
//-------------------------------------------------
export default mongoose.model('Deployment', schema);