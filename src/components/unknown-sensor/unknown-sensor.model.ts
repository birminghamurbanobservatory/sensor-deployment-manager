//-------------------------------------------------
// Dependencies
//-------------------------------------------------
import * as mongoose from 'mongoose';
import {kebabCaseRegex} from '../../utils/regular-expressions';


//-------------------------------------------------
// Schema
//-------------------------------------------------
const schema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    immutable: true, // prevents this from being updated
    maxlength: [44, 'Unknown sensor id is too long'],
    validate: {
      validator: (value): boolean => {
        return kebabCaseRegex.test(value);
      },
      message: (props): string => {
        return `Unknown sensor id must be kebab case. ${props.value} is not.`;
      }
    }
  },
  nObservations: {
    type: Number
  },
  lastObservation: {} // anything goes here. N.b. this also means it won't do any type casting, e.g. for the resultTime.
}, {
  timestamps: true // automatically adds createdAt and updatedAt fields
});


//-------------------------------------------------
// Indexes
//-------------------------------------------------
// You can end up with a mongo warning if you try to add an index for just the _id, as in MongoDB's mind it already has it's own index for _id, however it doesn't seem to recognise that we want a text index. For now I've add a random extra property to keep it happy.
schema.index({_id: 'text', randomFieldToStopWarning: 'text'});


//-------------------------------------------------
// Create Model (and expose it to our app)
//-------------------------------------------------
export default mongoose.model('UnknownSensor', schema);