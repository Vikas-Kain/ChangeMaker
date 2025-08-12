import mongoose, { Schema } from "mongoose";

const followSchema = new mongoose.Schema({
    follower: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    following: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

followSchema.index({ follower: 1, following: 1 }, { unique: true }); // Ensure unique follower-following pairs

export const Follow = mongoose.model('Follow', followSchema);
