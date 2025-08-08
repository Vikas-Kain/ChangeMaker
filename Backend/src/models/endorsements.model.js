import mongoose, { Schema } from "mongoose";

const endorsementSchema = new Schema({
    project: {
        type: Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    endorser: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    endorsementText: {
        type: String,
        required: true,
        maxlength: 500,
        trim: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    }
}, { timestamps: true });

endorsementSchema.index({ project: 1, endorser: 1 }, { unique: true });

export const Endorsement = mongoose.model("Endorsement", endorsementSchema);