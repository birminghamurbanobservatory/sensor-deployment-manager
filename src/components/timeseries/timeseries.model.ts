//-------------------------------------------------
// Dependencies
//-------------------------------------------------
import * as mongoose from 'mongoose';


//-------------------------------------------------
// Schema
//-------------------------------------------------

const schema = new mongoose.Schema({
  madeBySensor: {
    type: String,
    required: true
  },
  firstObsDate: {
    type: Date,
    required: true
  },
  lastObsDate: {
    type: Date,
    required: true
  },
  inDeployments: {
    type: String
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


});


//-------------------------------------------------
// Indexes
//-------------------------------------------------
// TODO: Probably a better index than this?
// See this stackoverflow post on the best way to query a date range: https://stackoverflow.com/questions/15601933/mongodb-index-strategy-for-range-query-with-different-fields
schema.index({inDeployment: 1, hostedByPath: 1, endDate: 1, startDate: 1});


//-------------------------------------------------
// Create Model (and expose it to our app)
//-------------------------------------------------
export default mongoose.model('Timeseries', schema);