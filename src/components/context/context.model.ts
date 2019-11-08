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
      type: String
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
// TODO: This might not be the best index, depends on the type of query you'll make most.
schema.index({sensor: 1, endDate: 1, startDate: 1});


//-------------------------------------------------
// Create Model (and expose it to our app)
//-------------------------------------------------
export default mongoose.model('Context', schema);