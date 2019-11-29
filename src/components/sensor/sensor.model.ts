//-------------------------------------------------
// Dependencies
//-------------------------------------------------
import * as mongoose from 'mongoose';
import {kebabCaseRegex} from '../../utils/regular-expressions';


//-------------------------------------------------
// Schema
//-------------------------------------------------
const ifSchema = new mongoose.Schema({
  if: {
    observedProperty: String,
    hasFeatureOfInterest: String,
    usedProcedures: [String]
    // If you ever need more advanced if conditions then you could could try using the format:
    // usedProcedures: {$contains: 'mean-average'}
  },
  value: {}  // i.e. mongodb's way of implying 'any'
});


const schema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    immutable: true, // prevents this from being updated
    maxlength: [44, 'Sensor id is too long'],
    validate: {
      validator: (value): boolean => {
        return kebabCaseRegex.test(value);
      },
      message: (props): string => {
        return `Sensor id must be kebab case. ${props.value} is not.`;
      }
    }
  },
  name: {
    type: String,
    maxlength: [40, 'Sensor name is too long']
  },
  description: {
    type: String,
    maxlength: [1000, 'Sensor description is too long'],
    default: ''
  },
  // A sensor can only ever belong to a single deployment at a time.
  inDeployment: {
    type: String
  },
  // A sensor can only ever be hosted on a single platform, however this platform can be hosted on further platforms, and platforms can be shared between deployments.
  isHostedBy: {
    type: String
  },
  permanentHost: {
    type: String
  },
  defaults: {
    observedProperty: { 
      value: String,
    },
    hasFeatureOfInterest: { 
      value: String,
      ifs: {
        type: [ifSchema],
        default: undefined
      } 
    },
    usedProcedures: {
      value: {
        type: [String],
        default: undefined
      } 
    }
  },
}, {
  timestamps: true // automatically adds createdAt and updatedAt fields
});


//-------------------------------------------------
// Indexes
//-------------------------------------------------
schema.index({permanentHost: 1});
schema.index({inDeployment: 1, isHostedBy: 1});


//-------------------------------------------------
// Create Model (and expose it to our app)
//-------------------------------------------------
export default mongoose.model('Sensor', schema);