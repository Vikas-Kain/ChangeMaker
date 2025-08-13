import { ApiError } from "./ApiError";

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

export { validateInterests, validateLocationCoordinates }