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
    // If you ever need more advanced if conditions then you could could try using the format:
    // usedProcedures: {$contains: 'mean-average'}
  },
  value: {} // i.e. mongodb's way of implying 'any'
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
  toAdd: {
    // The following properties are added unless they are already defined in the observation.
    // Although a sensor can only ever be bound to a single deployment, the platform its on might be shared between other deployments and thus inDeployments needs to be an array.
    inDeployments: {
      type: [String],
      default: undefined // this stop the default from being an empty array
    },
    // inDeployments and hostedByPath won't need a ifs array and thus we don't need the value property, this also makes it far easy to find contexts that need updating when a platform path or deployment changes for a sensor.
    hostedByPath: {
      // came to the conclusion that an Array of Ancestors is easier than a materialized path.
      type: [String],
      default: undefined

    },
    observedProperty: { 
      value: {
        type: String
      }
    },
    hasFeatureOfInterest: { 
      value: {
        type: String
      },
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
  }
});



//-------------------------------------------------
// Indexes
//-------------------------------------------------
// There should only ever be 1 "live" (i.e. endDate is unset) context per sensor at any given time.
schema.index({sensor: 1, endDate: 1}, {unique: true});
schema.index({'toAdd.hostedByPath': 1});
// TODO: Might need another index for performance, depending on the queries you'll make most. E.g. if you ever need to get a list of every live context then add another index with the endDate listed first.


//-------------------------------------------------
// Create Model (and expose it to our app)
//-------------------------------------------------
export default mongoose.model('Context', schema);