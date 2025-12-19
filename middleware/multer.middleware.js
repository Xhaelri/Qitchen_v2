// import multer from "multer";
// import { fileURLToPath } from "url";
// import path from "path";

// const _filename = fileURLToPath(import.meta.url);
// const _dirname = path.dirname(_filename);

// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         const filePath = path.resolve(_dirname, "../public/temp");
//         cb(null, filePath)
//     },
//     filename: function (req, file, cb) {
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
//         cb(null, file.fieldname + '-' + uniqueSuffix)
//     }
// })

// export const upload = multer({ storage: storage })



import multer from "multer";

// Use memory storage instead of disk storage
const storage = multer.memoryStorage();

export const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Validate file types
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(file.originalname.toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WEBP) are allowed!'));
        }
    }
});