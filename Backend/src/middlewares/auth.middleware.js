import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";

const verifyJWT = asyncHandler(async (req, _, next) => {
    const accessToken = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

    if (!accessToken) {
        throw new ApiError(401, "Unauthorized: No token provided");
    }

    try {
        const decodedToken = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);

        req.user = await User.findById(decodedToken._id).select("-password -refreshToken"); // attach user info to request object
        if (!req.user) {
            throw new ApiError(401, "Unauthorized: Invalid token");
        }

        next();
    } catch (error) {
        console.error('JWT verification error:', error);
        throw new ApiError(401, "Unauthorized: Invalid token");
    }
});

export { verifyJWT };