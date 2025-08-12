import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { uploadFileOnCloudinary } from "../utils/cloudinary.js";
import { deleteFile } from "../utils/deleteFile.js";
import jwt from "jsonwebtoken";
// import validator from "validator";


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
    if (!accessToken || !refreshToken) {
        throw new ApiError(500, "Failed to generate tokens");
    }

    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });  // save refresh token in DB

    return { accessToken, refreshToken };
}

const validateInterests = (interestArray) => {
    const validInterests = ['environment', 'education', 'health', 'community', 'technology', 'other'];
    for (const interest of interestArray) {
        if (!validInterests.includes(interest)) {
            throw new ApiError(400, `Invalid interest: ${interest}`);
        }
    }
}

const validateLocationCoordinates = (locationCoordinates) => {
    if (!Array.isArray(locationCoordinates) || locationCoordinates.length !== 2) {
        throw new ApiError(400, "Location coordinates must be an array of [lng, lat]");
    }
    locationCoordinates = locationCoordinates.map(coord => Number(coord));
    if (locationCoordinates[0] < -180 || locationCoordinates[0] > 180 || locationCoordinates[1] < -90 || locationCoordinates[1] > 90) {
        throw new ApiError(400, "Invalid longitude/latitude values");
    }
    return locationCoordinates;
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

    if (!avatarLocalPath) {
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
    if (interestArray.length > 0) {
        validateInterests(interestArray);
    }

    // validate location
    const location = req.body.location?.trim() || "";
    const locationCoordinates = req.body.locationCoordinates ? validateLocationCoordinates(req.body.locationCoordinates) : null;

    // validate email (regex, valid email)
    if (!emailRegex.test(email)) {
        await cleanupFiles(avatarLocalPath, coverImageLocalPath)
        throw new ApiError(400, "Invalid Email")
    }
    // if (!validator.isEmail(email)) {
    //     await cleanupFiles(avatarLocalPath, coverImageLocalPath)
    //     throw new ApiError(400, "Invalid Email")
    // }

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
        username: username.trim().toLowerCase(),
        fullname: fullname.trim(),
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
    // const isEmail = validator.isEmail(userId.trim());
    const isEmail = emailRegex.test(userId.trim());
    const query = isEmail ? { email: userId.trim() } : { username: userId.trim().toLowerCase() };

    // check if user exists in DB
    const user = await User.findOne(query);

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

const logoutUser = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "Unauthorized: No user found");
    }

    // clear refresh token in DB
    await User.findByIdAndUpdate(
        userId,
        {
            $unset: {
                refreshToken: 1     // can also set refreshToken as null
            }
        }
    );

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // set secure flag in production
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, {}, "User logged out successfully")
        )
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.header("Authorization")?.replace("Bearer ", "");

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized: No refresh token provided");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decodedToken._id).select("-password");

        if (!user) {
            throw new ApiError(401, "Unauthorized: Invalid refresh token");
        }

        // check if refresh token in DB matches the incoming refresh token
        if (user.refreshToken !== incomingRefreshToken) {
            throw new ApiError(401, "Unauthorized: Refresh token mismatch");
        }

        // generate new access token
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
                    "Access token refreshed successfully")
            );
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            throw new ApiError(401, "Refresh token expired");
        }
        throw new ApiError(401, "Invalid refresh token");
    }
});

const changePassword = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "Unauthorized: UserId required");
    }

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        throw new ApiError(400, "Old password and new password are required");
    }

    if (oldPassword === newPassword) {
        throw new ApiError(400, "New password must be different from old password");
    }

    if (newPassword.length < 6) {
        throw new ApiError(400, "New password must be at least 6 characters long");
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isOldPasswordCorrect = await user.comparePassword(oldPassword);
    if (!isOldPasswordCorrect) {
        throw new ApiError(401, "Old password is incorrect");
    }

    user.password = newPassword;
    await user.save();

    return res
        .status(200)
        .json(
            new ApiResponse(200,
                {
                    user: sanitizeUser(user)
                },
                "Password changed successfully")
        );
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    user: sanitizeUser(req.user)
                },
                "Current user fetched successfully")
        );
});

const updateUserDetails = asyncHandler(async (req, res) => {
    if (!req.user || !req.user._id) {
        throw new ApiError(401, "Unauthorized: User not found");
    }

    const fullname = req.body.fullname?.trim() || "";
    const bio = req.body.bio?.trim() || "";
    const location = req.body.location?.trim() || "";

    const locationCoordinates = req.body.locationCoordinates ? validateLocationCoordinates(req.body.locationCoordinates) : null;

    const interests = req.body.interests ? req.body.interests.split(',').map(interest => interest.trim().toLowerCase()) : [];
    if (interests.length > 0) {
        validateInterests(interests);
    }

    if ((!fullname || fullname.length == 0) && (!bio || bio.length == 0) && (!location || location.length == 0) && !locationCoordinates && interests.length == 0) {
        throw new ApiError(400, "At least one field required")
    }

    const user = await User.findById(req.user?._id);

    if (!user) {
        throw new ApiError(404, "Unauthorized: User not found");
    }

    // update user details
    user.fullname = fullname?.length > 0 ? fullname : user.fullname;
    user.bio = bio?.length > 0 ? bio : user.bio;
    user.location = location?.length > 0 ? location : user.location;
    user.locationCoordinates = locationCoordinates ? {
        type: "Point",
        coordinates: locationCoordinates
    } : user.locationCoordinates;
    user.interests = interests.length > 0 ? interests : user.interests;

    const updatedUser = await user.save({ validateBeforeSave: false }); // skip validation for this update

    if (!updatedUser) {
        throw new ApiError(500, "Failed to update user details");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200,
                {
                    user: sanitizeUser(updatedUser)
                },
                "User details updated successfully"
            )
        )

});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file required")
    }

    // upload on cloudinary
    const avatar = await uploadFileOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(500, "Error uploading avatar file on cloudinary")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password")

    return res
        .status(200)
        .json(
            new ApiResponse(200, {
                user: sanitizeUser(user)
            },
                "Avatar updated successfully")
        )
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "CoverImage file required")
    }

    // upload on cloudinary
    const coverImage = await uploadFileOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(500, "Error uploading coverImage file on cloudinary")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }
    ).select("-password")

    return res
        .status(200)
        .json(
            new ApiResponse(200, {
                user: sanitizeUser(user)
            },
                "cover Image updated successfully")
        )
});

export {
    registerUser, loginUser, logoutUser, refreshAccessToken, changePassword, getCurrentUser, updateUserDetails, updateUserAvatar, updateUserCoverImage
}