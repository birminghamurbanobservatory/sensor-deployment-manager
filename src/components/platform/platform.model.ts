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
    maxlength: [48, 'Platform id is too long'], // length accounts for suffix added to permanentHost id.
    validate: {
      validator: (value): boolean => {
        return kebabCaseRegex.test(value);
      },
      message: (props): string => {
        return `Platform id must be kebab case. ${props.value} is not.`;
      }
    }
  },
  name: {
    type: String, 
    required: true,
    maxlength: [40, 'Platform name is too long']
  },
  description: {
    type: String,
    maxlength: [1000, 'Platform description is too long'],
    default: ''
  },
  ownerDeployment: {
    type: String,
    required: true
  },
  inDeployments: {
    type: [String]
  },
  isHostedBy: {
    type: String
  },
  hostedByPath: {
    type: [String],
    default: undefined
  },
  static: {
    type: Boolean,
    required: true
  },
  // if created from a permanentHost then make a note of the permanentHost id.
  initialisedFrom: {
    type: String
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
schema.index({inDeployments: 1});
schema.index({hostedByPath: 1});


//-------------------------------------------------
// Create Model (and expose it to our app)
//-------------------------------------------------
export default mongoose.model('Platform', schema);