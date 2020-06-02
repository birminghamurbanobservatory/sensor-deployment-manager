//-------------------------------------------------
// Dependencies
//-------------------------------------------------
import * as mongoose from 'mongoose';


//-------------------------------------------------
// Schema
//-------------------------------------------------
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
  units: {
    type: [String],
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
export default mongoose.model('ObservableProperty', schema);