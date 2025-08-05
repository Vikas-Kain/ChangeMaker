import mongoose, { Schema } from "mongoose";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        minlength: 3,
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    fullname: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true
    },
    password: {
        type: String,
        required: [true, "password is required"]
    },
    avatar: {
        type: String,   // cloudinary url
        required: true
    },
    coverImage: {
        type: String
    },
    bio: {
        type: String,
        maxlength: 200
    },
    interests: [
        {
            type: String,
            lowercase: true,
            trim: true
        }
    ],
    isVerified: {
        type: Boolean
    },
    trustScore: {
        type: Number,
        default: 0
    },
    impactScore: {
        type: Number,
        default: 0
    },
    location: {
        type: String,
        lowercase: true,
        trim: true
    },
    locationCoordinates: {
        type: {
            type: String,  // 'Point'
            enum: ['Point'],
        },
        coordinates: {
            type: [Number],  // [longitude, latitude]
            validate: {
                validator: function (value) {
                    return value.length === 2;
                },
                message: 'Coordinates must be an array of [lng, lat]'
            },
            index: "2dsphere"  // for geospatial queries
        }
    },
    history: [
        {
            type: Schema.Types.ObjectId,
            ref: "Project"
        }
    ],
    projects: [
        {
            type: Schema.Types.ObjectId,
            ref: "Project"
        }
    ],
    posts: [
        {
            type: Schema.Types.ObjectId,
            ref: "Post"
        }
    ],
    refreshToken: {
        type: String
    }
}, { timestamps: true });

export const User = mongoose.model("User", userSchema);