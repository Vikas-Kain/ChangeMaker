import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { uploadFileOnCloudinary } from "../utils/cloudinary.js";
import { deleteFile } from "../utils/deleteFile.js";


const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // simple email regex

const cleanupFiles = async (...filePaths) => {
    for (const filePath of filePaths) {
        if (filePath) {
            try {
                await deleteFile(filePath);
            } catch (error) {
                console.error(`Error deleting file at ${filePath}:`, error.message);
            }
        }
    }
}

const validateLocationCoordinates = (coordinates) => {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
        return false;
    }
    return coordinates.every(coord => typeof coord === 'number' && !isNaN(coord));
}


const registerUser = asyncHandler(async (req, res) => {
    // input text fields
    const { username, email, fullname, password, interests } = req.body

    // input files
    const avatarFile = req.files?.avatar?.[0]
    const coverImageFile = req.files?.coverImage?.[0]

    const avatarLocalPath = avatarFile?.path
    const coverImageLocalPath = coverImageFile?.path

    // validate input fields
    if ([username, email, fullname, password].some
        ((field) => field?.trim() === "")) {
        await cleanupFiles(avatarLocalPath, coverImageLocalPath)
        throw new ApiError(400, "All fields are required")
    };
    // valiate password length
    if (password.length < 6) {
        await cleanupFiles(avatarLocalPath, coverImageLocalPath)
        throw new ApiError(400, "Password must be at least 6 characters long")
    }

    // check if bio is provided and validate its length
    const bio = req.body.bio?.trim() || "";
    if (bio.length > 200) {
        await cleanupFiles(avatarLocalPath, coverImageLocalPath)
        throw new ApiError(400, "Bio must be less than 200 characters")
    }

    // validate interests
    const interestArray = interests ? interests.split(',').map(interest => interest.trim().toLowerCase()) : [];
    const validInterests = ['environment', 'education', 'health', 'community', 'technology', 'other'];
    for (const interest of interestArray) {
        if (!validInterests.includes(interest)) {
            await cleanupFiles(avatarLocalPath, coverImageLocalPath)
            throw new ApiError(400, `Invalid interest: ${interest}. Valid interests are: ${validInterests.join(', ')}`);
        }
    }

    // validate location
    const location = req.body.location?.trim() || "";
    let locationCoordinates = req.body.locationCoordinates;

    if (Array.isArray(locationCoordinates)) {
        locationCoordinates = locationCoordinates.map(coord => Number(coord.strip()));
    }
    if ( locationCoordinates && !validateLocationCoordinates(locationCoordinates) ) {
        await cleanupFiles(avatarLocalPath, coverImageLocalPath)
        throw new ApiError(400, "Location coordinates must be an array of [lng, lat]");
    }
    
    // validate email (regex, valid email)
    if (!emailRegex.test(email)) {
        await cleanupFiles(avatarLocalPath, coverImageLocalPath)
        throw new ApiError(400, "Invalid Email")
    }

    // check if email or username already exists : User.findOne({email}) or:
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })


    if (existedUser) {
        await cleanupFiles(avatarLocalPath, coverImageLocalPath)
        throw new ApiError(400, "username or email already exists!")
    }

    // upload on cloudinary
    const avatar = await uploadFileOnCloudinary(avatarLocalPath)
    if (!avatar) {
        await cleanupFiles(avatarLocalPath, coverImageLocalPath)
        throw new ApiError(500, "Couldn't upload Avatar. Try again")
    }

    const coverImage = await uploadFileOnCloudinary(coverImageLocalPath)
    if (coverImageLocalPath && !coverImage) {
        await cleanupFiles(avatarLocalPath, coverImageLocalPath)
        throw new ApiError(500, "Couldn't upload Cover Image. Try again")
    }

    // Create user in DB
    const user = await User.create({
        username: username.toLowerCase(),
        fullname: fullname.toLowerCase(),
        email,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        bio,
        interests: interestArray,
        location: location?.trim() || "",
        locationCoordinates: locationCoordinates ? {
            type: "Point",
            coordinates: locationCoordinates
        } : null,
    })

    // console.log(coverImage)
    // console.log(avatar)

    // check if user is created in DB
    const createdUser = await User.findById(user._id).select("-password -refreshToken")     // remove password and refreshToken
    if (!createdUser) {
        throw new ApiError(500, "Failed to create user in Database")
    }

    return res.status(201).json(
        new ApiResponse(201, createdUser.toObject(), "User Registered Successfully")
    )

});

export {
    registerUser
};