import { ApiError } from "./ApiError.js";
import EmailValidationAPI from "email-address-validation"

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

const validateUsername = (username) => {
    if (!username || typeof username !== 'string') {
        throw new Error('Username must be a non-empty string');
    }

    const trimmedUsername = username.trim().toLowerCase();

    if (trimmedUsername.length < 3 || trimmedUsername.length > 39) {
        throw new Error('Username must be between 3 and 39 characters long');
    }

    // GitHub-style username regex: 3-39 characters, alphanumeric and hyphens only, no consecutive hyphens, no leading/trailing hyphens
    const usernameRegex = /^(?!-)[a-z0-9-]{3,39}(?<!-)$/;

    if (!usernameRegex.test(trimmedUsername)) {
        throw new Error('Username must contain only lowercase letters, numbers, and hyphens. Cannot start or end with a hyphen, and cannot contain consecutive hyphens.');
    }

    return trimmedUsername;
};

const emailValidationApi = new EmailValidationAPI({ access_key: process.env.MAILBOXLAYER_API_KEY });
const validateEmail = async (email) => {
    try {
        const result = await emailValidationApi.check(email);
        return result;
    } catch (err) {
        console.error("Email validation error:", err);
        throw new ApiError(500, "Could not validate email");
    }
}

export { validateInterests, validateLocationCoordinates, validateUsername, validateEmail }