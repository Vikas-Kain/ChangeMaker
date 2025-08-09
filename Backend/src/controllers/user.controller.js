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

const sanitizeUser = (user) => {
    const sanitizedUser = user.toObject();
    delete sanitizedUser.password;
    delete sanitizedUser.refreshToken;
    return sanitizedUser;
}

const generateAccessAndRefreshToken = async (user) => {
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    user.refreshToken = refreshToken;
    
    await user.save();  // save refresh token in DB
    if (!accessToken || !refreshToken) {
        throw new ApiError(500, "Failed to generate tokens");
    }
    return { accessToken, refreshToken };
}


// register user
const registerUser = asyncHandler(async (req, res) => {
    // input text fields
    const { username, email, fullname, password, interests } = req.body

    // input files
    const avatarFile = req.files?.avatar?.[0]
    const coverImageFile = req.files?.coverImage?.[0]

    const avatarLocalPath = avatarFile?.path
    const coverImageLocalPath = coverImageFile?.path

    if ( !avatarLocalPath ) {
        await cleanupFiles(avatarLocalPath, coverImageLocalPath)
        throw new ApiError(400, "Avatar is required")
    }

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

    if (locationCoordinates) {
        if (!Array.isArray(locationCoordinates) || locationCoordinates.length !== 2) {
            await cleanupFiles(avatarLocalPath, coverImageLocalPath)
            throw new ApiError(400, "Location coordinates must be an array of [lng, lat]");
        }
        locationCoordinates = locationCoordinates.map(coord => Number(coord));
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

    return res
    .status(201)
    .json(
        new ApiResponse(201, createdUser.toObject(), "User Registered Successfully")
    )

});

// login user
const loginUser = asyncHandler(async (req, res) => {
    // input text fields
    const { userId, password } = req.body

    // validate input fields
    if (!userId || !password) {
        throw new ApiError(400, "User ID and Password are required")
    }

    // check if userId is email or username
    const isEmail = emailRegex.test(userId.trim());
    const email = isEmail ? userId.trim() : null;
    const username = isEmail ? null : userId.trim();

    // check if user exists in DB
    const user = await User.findOne({
        $or: [
            { email },
            { username }
        ]
    });

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    // check if password is correct
    const isPasswordCorrect = await user.comparePassword(password)
    if (!isPasswordCorrect) {
        throw new ApiError(401, "Invalid Password")
    }

    // generate access and refresh token
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user);

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // set secure flag in production
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: sanitizeUser(user), accessToken, refreshToken
                },
                "User Logged In Successfully"
            )
        )
});

export {
    registerUser, loginUser
};