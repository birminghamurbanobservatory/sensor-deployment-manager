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
    maxlength: [44, 'id is too long'],
    validate: {
      validator: (value): boolean => {
        return kebabCaseRegex.test(value);
      },
      message: (props): string => {
        return `Deployment id must be camel case. ${props.value} is not.`;
      }
    }
  },
  name: {
    type: String, 
    required: true,
    maxlength: [40, 'name is too long']
  },
  description: {
    type: String,
    maxlength: [1000, 'description is too long'],
    default: ''
  },
  public: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: String
  }
}, {
  timestamps: true // automatically adds createdAt and updatedAt fields
});



//-------------------------------------------------
// Create Model (and expose it to our app)
//-------------------------------------------------
export default mongoose.model('Deployment', schema);