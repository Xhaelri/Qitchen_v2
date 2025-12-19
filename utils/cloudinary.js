// import { v2 as cloudinary } from "cloudinary";
// import fs from "fs";

//   cloudinary.config({
//     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//     api_key: process.env.CLOUDINARY_API_KEY,
//     api_secret: process.env.CLOUDINARY_API_SECRET,
//   });

// const uploadOnCloudinary = async (localFilePath) => {
//     try {
//         if (!localFilePath) {
//             return console.log("Local file path is required")
//         }
//         const response = await cloudinary.uploader.upload(localFilePath, {
//             resource_type: "image"
//         })
//         console.log("The file uploaded successfully", response.url)
//         fs.unlinkSync(localFilePath)
//         return response

//     } catch (err) {
//         fs.unlinkSync(localFilePath) //if upload got failed it will remove the file path
//         return null;
//     }
// }

// const destroyFromCloudinary = async (publicId) => {
//     try {
//         if (!publicId) return console.log("File public id is required")
//         const response = await cloudinary.uploader.destroy(publicId, {
//             resource_type: "image"
//         })
//         //check for the response
//         console.log("The file deleted successfully")
//         return response;
//     } catch (err) {
//         console.error("Error while deleting the file from cloudinary", err)
//         return null;
//     }
// }
// const destroyMultipleFromCloudinary = async (publicIds = []) => {
//     try {
//         for (const publicId of publicIds) {
//             await cloudinary.uploader.destroy(publicId, {
//                 resource_type: "image",
//             });
//             console.log(`Deleted ${publicId} from cloudinary`);
//         }
//     } catch (err) {
//         console.error("Error while deleting multiple files from cloudinary", err);
//     }
// };
// export {
//     destroyFromCloudinary,
//     uploadOnCloudinary,
//     destroyMultipleFromCloudinary
// }


import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload from buffer (memory) instead of file path
const uploadOnCloudinary = async (fileBuffer, originalName, folder = "products") => {
    try {
        if (!fileBuffer) {
            throw new Error("File buffer is required");
        }

        const response = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    resource_type: "image",
                    folder: folder, // Organize uploads in folders
                    public_id: `${folder}/${Date.now()}-${Math.round(Math.random() * 1E9)}`,
                    transformation: [
                        { quality: "auto:good" }, // Automatic quality optimization
                        { fetch_format: "auto" }, // Automatic format selection
                        { width: 1000, height: 1000, crop: "limit" } // Resize large images
                    ]
                },
                (error, result) => {
                    if (error) {
                        console.error("Cloudinary upload error:", error);
                        reject(error);
                    } else {
                        console.log("File uploaded successfully:", result.secure_url);
                        resolve(result);
                    }
                }
            ).end(fileBuffer);
        });

        return response;
    } catch (err) {
        console.error("Error uploading to Cloudinary:", err);
        throw err;
    }
};

// Upload multiple files from buffers
const uploadMultipleOnCloudinary = async (files, folder = "products") => {
    try {
        const uploadPromises = files.map(file => 
            uploadOnCloudinary(file.buffer, file.originalname, folder)
        );
        
        const results = await Promise.all(uploadPromises);
        return results;
    } catch (error) {
        console.error("Error uploading multiple files:", error);
        throw error;
    }
};

const destroyFromCloudinary = async (publicId) => {
    try {
        if (!publicId) {
            throw new Error("File public id is required");
        }
        
        const response = await cloudinary.uploader.destroy(publicId, {
            resource_type: "image"
        });
        
        console.log("File deleted successfully");
        return response;
    } catch (err) {
        console.error("Error while deleting the file from cloudinary", err);
        throw err;
    }
};

const destroyMultipleFromCloudinary = async (publicIds = []) => {
    try {
        const deletePromises = publicIds.map(publicId => 
            cloudinary.uploader.destroy(publicId, { resource_type: "image" })
        );
        
        await Promise.all(deletePromises);
        console.log(`Deleted ${publicIds.length} files from cloudinary`);
    } catch (err) {
        console.error("Error while deleting multiple files from cloudinary", err);
        throw err;
    }
};

export {
    destroyFromCloudinary,
    uploadOnCloudinary,
    uploadMultipleOnCloudinary,
    destroyMultipleFromCloudinary
};