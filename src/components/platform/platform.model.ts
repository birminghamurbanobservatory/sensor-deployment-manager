//-------------------------------------------------
// Dependencies
//-------------------------------------------------
import * as mongoose from 'mongoose';
import {kebabCaseRegex} from '../../utils/regular-expressions';


//-------------------------------------------------
// Schema
//-------------------------------------------------
const centroidSchema = new mongoose.Schema({
  lat: {
    type: Number, // WGS 84
    required: true,
    min: -90,
    max: 90
  },
  lng: {
    type: Number,
    required: true,
    min: -180,
    max: 180
  },
  height: {
    type: Number, // in meters
    required: false
  }
}, {
  _id: false, // stops this subdocument from having it's own _id
});

const geometrySchema = new mongoose.Schema({
  type: {
    $type: String,
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
  }
}, {
  _id: false, // stops this subdocument from having it's own _id
});

const schema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    immutable: true, // prevents this from being updated
    maxlength: [48, 'Platform id is too long'], // length accounts for suffix added to permanentHost id.
    validate: {
      validator: (value): boolean => {
        return kebabCaseRegex.test(value);
      },
      message: (props): string => {
        return `Platform id must be kebab case. ${props.value} is not.`;
      }
    }
  },
  name: {
    type: String,
    required: true,
    maxlength: [40, 'Platform name is too long']
  },
  description: {
    type: String,
    maxlength: [1000, 'Platform description is too long'],
    default: ''
  },
  ownerDeployment: {
    type: String,
    required: true
  },
  inDeployments: {
    type: [String]
  },
  isHostedBy: {
    type: String
  },
  hostedByPath: {
    type: [String],
    default: undefined
  },
  // If the platform isn't hosted on any others, e.g. because it's a standalone platform or the first platfrom in the platform "tree" then this topPlatform will be the id of the platform itself, alternatively if this platform IS hosted on another then this topPlatform will be the first platformId in the hostedByPath. This required field essentially acts as an id each platform "tree", and comes in handy for returning multiple platforms in a nested format whilst handling pagination.
  topPlatform: {
    type: String,
    required: true
  },
  static: {
    type: Boolean,
    required: true
  },
  location: {
    type: locationSchema,
    required: false
  },
  updateLocationWithSensor: String,
  // if created from a permanentHost then make a note of the permanentHost id.
  initialisedFrom: {
    type: String
  },
  // for soft deletes
  deletedAt: { 
    type: Date
  }
}, {
  timestamps: true, // automatically adds createdAt and updatedAt fields
}); 


//-------------------------------------------------
// Indexes
//-------------------------------------------------
schema.index({inDeployments: 1});
schema.index({hostedByPath: 1});
schema.index({topPlatform: 1});
schema.index({updateLocationWithSensor: 1});
schema.index({_id: 'text', name: 'text'});
schema.index({'location.geometry': '2dsphere'}); // for geospatial queries


//-------------------------------------------------
// Create Model (and expose it to our app)
//-------------------------------------------------
export default mongoose.model('Platform', schema);