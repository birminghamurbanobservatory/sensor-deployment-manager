//-------------------------------------------------
// Dependencies
//-------------------------------------------------
import * as mongoose from 'mongoose';
import {kebabCaseRegex} from '../../utils/regular-expressions';


//-------------------------------------------------
// Schema
//-------------------------------------------------
const configSchema = new mongoose.Schema({
  hasPriority: {
    type: Boolean,
    required: true
  }, // if true then use this over the others when the observation has no observedProperty.
  observedProperty: {
    type: String,
    required: true // because the value of determines that this is the set of properties to apply.
  },
  unit: {
    type: String
  },
  hasFeatureOfInterest: {
    type: String
  },
  disciplines: {
    type: [String],
    default: undefined // so it doesn't assign an empty array by default
  },
  usedProcedures: {
    type: [String],
    default: undefined // so it doesn't assign an empty array by default
  }
}, {
  _id : false // Stops these sub-documents from having an _id added
});

const schema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    immutable: true, // prevents this from being updated
    maxlength: [48, 'Sensor id is too long'],
    validate: {
      validator: (value): boolean => {
        return kebabCaseRegex.test(value);
      },
      message: (props): string => {
        return `Sensor id must be kebab case. ${props.value} is not.`;
      }
    }
  },
  label: {
    type: String,
    required: true,
    maxlength: [44, 'Sensor label is too long']
  },
  description: {
    type: String,
    maxlength: [1000, 'Sensor description is too long'],
    default: ''
  },
  // A sensor can only ever belong to a single deployment at a time. Note it's hasDeployment rather inDeployment. This is a dintinction that SSN makes.
  hasDeployment: {
    type: String
  },
  isHostedBy: {
    type: String
  },
  permanentHost: {
    type: String
  },
  initialConfig: {
    type: [configSchema],
    default: [] // we want this to be an empty array by default
  },
  currentConfig: {
    type: [configSchema],
    default: [] // we want this to be an empty array by default
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
schema.index({permanentHost: 1});
schema.index({hasDeployment: 1, isHostedBy: 1});
schema.index({isHostedBy: 1}); // comes in handy when getting nested platforms including the sensors
schema.index({_id: 'text', label: 'text'});


//-------------------------------------------------
// Create Model (and expose it to our app)
//-------------------------------------------------
export default mongoose.model('Sensor', schema);