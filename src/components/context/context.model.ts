//-------------------------------------------------
// Dependencies
//-------------------------------------------------
import * as mongoose from 'mongoose';


//-------------------------------------------------
// Schema
//-------------------------------------------------
const ifSchema = new mongoose.Schema({
  if: {
    observedProperty: String,
    hasFeatureOfInterest: String,
    usedProcedures: [String]
  },
  then: {
    observedProperty: String,
    hasFeatureOfInterest: String,
    usedProcedures: [String]
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
    type: Date,
    required: true
  },
  // The following is added unless they are already defined in the observation.
  toAdd: {
    // Although a sensor can only ever be bound to a single deployment, the platform its on might be shared between other deployments and thus the following needs to be an array.
    inDeployments: {
      type: [String]
    },
    hostedByPath: {
      type: [String]
    },
    observedProperty: { 
      type: String
    },
    hasFeatureOfInterest: { 
      type: String
    },
    usedProcedures: {
      type: [String]
    }
  },
  // The ifs can overwrite what's in the toAdd if they are a match with the incoming observation.
  ifs: [ifSchema]
});


//-------------------------------------------------
// Indexes
//-------------------------------------------------
// There should only ever be 1 "live" (i.e. endDate is unset) context per sensor at any given time.
schema.index({sensor: 1, endDate: 1}, {unique: true});
// TODO: Might need another index for performance, depending on the queries you'll make most. E.g. if you ever need to get a list of every live context then add another index with the endDate listed first.


//-------------------------------------------------
// Create Model (and expose it to our app)
//-------------------------------------------------
export default mongoose.model('Context', schema);