import { deleteFile } from "../utils/deleteFile.js";
import { uploadFileOnCloudinary } from "../utils/cloudinary.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { validateInterests, validateLocationCoordinates } from "../utils/validateField.js";


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


const registerUserService = async (userData, userFiles) => {
    try {
        // input text fields
        const { username, email, fullname, password, interests } = userData
    
        // input files
        const avatarFile = userFiles?.avatar?.[0]
        const coverImageFile = userFiles?.coverImage?.[0]
    
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
        const bio = userData.bio?.trim() || "";
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
        const location = userData.location?.trim() || "";
        const locationCoordinates = userData.locationCoordinates ? validateLocationCoordinates(userData.locationCoordinates) : null;
    
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
    
        // check if user is created in DB
        const createdUser = await User.findById(user._id).select("-password -refreshToken")     // remove password and refreshToken
        if (!createdUser) {
            throw new ApiError(500, "Failed to create user in Database")
        }
    
        return createdUser;
    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Failed to change password")
    }
}

const loginUserService = async (userData) => {
    try {
        // input text fields
        const { userId, password } = userData
    
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

        if ( !accessToken || !refreshToken ) {
            throw new ApiError(500, "Failed to generate token while logging in")
        }
    
        return { user, accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Failed to login user")
    }
}

const logoutUserService = async (userId) => {
    try {
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
    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Failed to logout user")
    }
}

const refreshAccessTokenService = async (incomingRefreshToken) => {
    try {
        if (!incomingRefreshToken) {
            throw new ApiError(401, "Unauthorized: No refresh token provided");
        }
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

        if ( !accessToken || !refreshToken ) {
            throw new ApiError(500, "Failed to refresh access token")
        }

        return { user, accessToken, refreshToken };

    } catch (error) {
        if (error.name === "TokenExpiredError") {
            throw new ApiError(401, "Refresh token expired");
        }
        throw new ApiError(401, "Invalid refresh token");
    }
}

const changePasswordService = async (userId, reqBody) => {
    try {
        if (!userId) {
            throw new ApiError(401, "Unauthorized: UserId required");
        }

        const { oldPassword, newPassword } = reqBody;

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
        const updatedUser = await user.save();

        if (!updatedUser) {
            throw new ApiError(500, "Failed to change user password");
        }

        return updatedUser;
    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Failed to change password")
    }
}


export { registerUserService, loginUserService, logoutUserService, refreshAccessTokenService, changePasswordService }