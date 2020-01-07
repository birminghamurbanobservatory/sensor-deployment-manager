//-------------------------------------------------
// Dependencies
//-------------------------------------------------
import * as mongoose from 'mongoose';


// TODO!!!!!!! Remove this if using timescale not mongo.

//-------------------------------------------------
// Schema
//-------------------------------------------------
const schema = new mongoose.Schema({
  platform: {
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
  location: {
    type: {
      type: String,
      enum: ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'],
      required: true
    },
    coordinates: {
      type: {}, // putting {} will allow anything
      required: true
    }
  }
});


//-------------------------------------------------
// Indexes
//-------------------------------------------------
// I think it makes sense for the endDate to go before the startDate for when I need to find the current location, i.e. when endDate doesn't exist.
schema.index({platform: 1, endDate: 1, startDate: 1}, {unique: true});
schema.index({geometry : '2dsphere'}); // TODO: Should this be on its own?


//-------------------------------------------------
// Create Model (and expose it to our app)
//-------------------------------------------------
export default mongoose.model('PlatformLocation', schema);