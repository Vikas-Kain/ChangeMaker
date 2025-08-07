import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        minlength: 3,
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


userSchema.index({ username: 'text', fullname: 'text', interests: 'text', location: 'text' });

userSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    if (this.isModified('username')) {
        this.username = this.username.toLowerCase();
    }
    if (this.isModified('fullname')) {
        this.fullname = this.fullname.toLowerCase();
    }
    if (this.isModified('email')) {
        this.email = this.email.toLowerCase();
    }
    next();
})

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
}


export const User = mongoose.model("User", userSchema);