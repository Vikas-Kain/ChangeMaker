import mongoose, { Schema } from "mongoose";

const memberSchema = new Schema({
    project: {
        type: Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    member: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    role: {
        type: String,
        required: true,
        enum: ['volunteer', 'manager', 'admin'],
        lowercase: true,
        default: 'volunteer',
    },
    customRole: {
        type: String,
        lowercase: true,
        trim: true,
        maxlength: 50,
        default: null
    },
    currentMembership: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

memberSchema.index({ project: 1, member: 1 , role: 1, createdAt: -1 });

export const Member = mongoose.model("Member", memberSchema);