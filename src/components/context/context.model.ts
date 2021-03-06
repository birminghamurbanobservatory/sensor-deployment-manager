//-------------------------------------------------
// Dependencies
//-------------------------------------------------
import * as mongoose from 'mongoose';


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
});


const schema = new mongoose.Schema({
  sensor: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  hasDeployment: {
    type: String,
  },
  // came to the conclusion that an Array of Ancestors is easier than a materialized path.
  hostedByPath: {
    type: [{
      type: String,
      ref: 'Platform'
    }],
    default: undefined
  },
  config: {
    type: [configSchema],
    default: [] // we want this to be an empty array by default
  } 
});



//-------------------------------------------------
// Indexes
//-------------------------------------------------
// There should only ever be 1 "live" (i.e. endDate is unset) context per sensor at any given time.
schema.index({sensor: 1, endDate: 1}, {unique: true});
schema.index({hostedByPath: 1});
// TODO: Might need another index for performance, depending on the queries you'll make most. E.g. if you ever need to get a list of every live context then add another index with the endDate listed first.


//-------------------------------------------------
// Create Model (and expose it to our app)
//-------------------------------------------------
export default mongoose.model('Context', schema);