//-------------------------------------------------
// Dependencies
//-------------------------------------------------
import * as mongoose from 'mongoose';


//-------------------------------------------------
// Schema
//-------------------------------------------------
const geometrySchema = new mongoose.Schema({
  type: {
    $type: String,
    enum: ['Point', 'LineString', 'Polygon'],
    required: true
  },
  coordinates: {
    $type: [],
    required: true
  }
}, {
  _id: false, // stops this subdocument from having it's own _id
  typeKey: '$type' // need to do this so I can use the 'type' key for the geojson location
});

const centroidSchema = new mongoose.Schema({
  type: {
    $type: String,
    enum: ['Point'], // centroid should only ever be a point
    required: true
  },
  coordinates: {
    $type: [],
    required: true
  }
  // Decided to use this GeoJSON format here rather than a simple lat/lon approach becauses MongoDB can easily create indexes from GeoJSON formatted properties (https://docs.mongodb.com/manual/geospatial-queries/#geospatial-indexes), thus if I ever want to perferm spatial queries on the centroid rather than the geometry then this should help.
}, {
  _id: false, // stops this subdocument from having it's own _id
  typeKey: '$type' // need to do this so I can use the 'type' key for the geojson location
});

const locationSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  validAt: {
    type: Date,
    required: true
  },
  geometry: {
    type: geometrySchema,
    required: true
  },
  centroid: {
    type: centroidSchema,
    required: true
  },
  height: {
    // in metres, above ground
    type: Number
    // MongoDB's 2dsphere index won't make use of the Z-coordinate, so it makes sense to store it separately.
  }
}, {
  _id: false, // stops this subdocument from having it's own _id
});

const schema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    immutable: true, // prevents this from being updated
    maxlength: [48, 'id is too long']
  },
  label: {
    type: String,
    required: true,
    maxlength: [44, 'label is too long']
  },
  description: {
    type: String,
    maxlength: [1000, 'description is too long'],
    default: ''
  },
  listed: {
    type: Boolean,
    default: true
  },
  inCommonVocab: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: String,
    immutable: true,
  },
  belongsToDeployment: {
    type: String  
  },
  deletedAt: {
    type: Date
  },
  location: {
    type: locationSchema
  }
}, {
  timestamps: true // automatically adds createdAt and updatedAt fields
});


//-------------------------------------------------
// Indexes
//-------------------------------------------------
schema.index({_id: 'text', label: 'text'});
schema.index({listed: 1});
schema.index({belongsToDeployment: 1});


//-------------------------------------------------
// Create Model (and expose it to our app)
//-------------------------------------------------
export default mongoose.model('FeatureOfInterest', schema);