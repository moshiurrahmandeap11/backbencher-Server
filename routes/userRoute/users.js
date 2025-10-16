const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

module.exports = (pool, admin) => {
  const router = express.Router();

  // Configure multer for multiple image uploads (profile image + cover photo)
  const profileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = 'uploads/profiles/';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uid = req.params.uid;
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, uid + '-profile-' + uniqueSuffix + ext);
    }
  });

  const coverStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = 'uploads/covers/';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uid = req.params.uid;
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, uid + '-cover-' + uniqueSuffix + ext);
    }
  });

  // File filter for images only
  const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  };

  const uploadProfile = multer({
    storage: profileStorage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    }
  });

  const uploadCover = multer({
    storage: coverStorage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    }
  });

const uploadMultiple = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      let uploadDir;
      
      if (file.fieldname === 'profileImage') {
        uploadDir = 'uploads/profiles/';
      } else if (file.fieldname === 'coverPhoto') {
        uploadDir = 'uploads/covers/';
      } else {
        uploadDir = 'uploads/others/';
      }
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uid = req.params.uid;
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      
      if (file.fieldname === 'profileImage') {
        cb(null, uid + '-profile-' + uniqueSuffix + ext);
      } else if (file.fieldname === 'coverPhoto') {
        cb(null, uid + '-cover-' + uniqueSuffix + ext);
      } else {
        cb(null, uid + '-' + uniqueSuffix + ext);
      }
    }
  }),
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

  // 🔹 Get all users
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM users ORDER BY createdat DESC');
      
      const users = result.rows.map(user => ({
        ...user
      }));
      
      res.json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Get user by UID
  router.get('/:uid', async (req, res) => {
    try {
      const uid = req.params.uid;
      console.log(`Fetching user with UID: ${uid}`);
      
      const result = await pool.query('SELECT * FROM users WHERE uid = $1', [uid]);
      
      if (result.rows.length === 0) {
        console.log(`User not found: ${uid}`);
        return res.status(404).json({ success: false, message: "User not found" });
      }
      
      const user = result.rows[0];
      
      console.log(`User found:`, user);
      res.json({ success: true, data: user });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Create user
  router.post('/', async (req, res) => {
    try {
      const { uid, name, email, age } = req.body;
      console.log("Creating user with data:", { uid, name, email, age });
      
      if (!uid || !name || !email) {
        return res.status(400).json({ success: false, message: "UID, name & email are required" });
      }

      // Check if user already exists
      const existsResult = await pool.query('SELECT * FROM users WHERE uid = $1', [uid]);
      if (existsResult.rows.length > 0) {
        return res.status(400).json({ success: false, message: "User already exists" });
      }

      const privacySettings = {
        name: 'public',
        email: 'public', 
        age: 'public',
        profileImage: 'public',
        coverPhoto: 'public'
      };

      // Add role field with default value 'user'
      const insertQuery = `
        INSERT INTO users (uid, name, email, age, privacysettings, profileimage, coverphoto, role) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *
      `;
      
      const result = await pool.query(insertQuery, [
        uid, 
        name, 
        email, 
        age, 
        privacySettings,
        null, // profileImage initially null
        null, // coverPhoto initially null
        'user' // role automatically set to 'user'
      ]);
      
      console.log("User created successfully:", result.rows[0].id);
      res.status(201).json({ 
        success: true, 
        message: "User created in PostgreSQL", 
        data: result.rows[0] 
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Update user with multiple image upload (PATCH)
  router.patch('/:uid', uploadMultiple.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'coverPhoto', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const uid = req.params.uid;
      
      console.log(`Patching user ${uid}`);
      console.log('Request body:', req.body);
      console.log('Uploaded files:', req.files);

      // Check if user exists
      const existingUser = await pool.query('SELECT * FROM users WHERE uid = $1', [uid]);
      if (existingUser.rows.length === 0) {
        // If files were uploaded but user not found, delete the files
        if (req.files) {
          if (req.files.profileImage) {
            req.files.profileImage.forEach(file => fs.unlinkSync(file.path));
          }
          if (req.files.coverPhoto) {
            req.files.coverPhoto.forEach(file => fs.unlinkSync(file.path));
          }
        }
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Build update query dynamically
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      // Handle text fields
      if (req.body.name !== undefined) {
        updateFields.push(`name = $${paramCount}`);
        values.push(req.body.name);
        paramCount++;
      }

      if (req.body.email !== undefined) {
        updateFields.push(`email = $${paramCount}`);
        values.push(req.body.email);
        paramCount++;
      }

      if (req.body.age !== undefined) {
        updateFields.push(`age = $${paramCount}`);
        values.push(req.body.age === '' ? null : parseInt(req.body.age));
        paramCount++;
      }

      // Handle role update
      if (req.body.role !== undefined) {
        updateFields.push(`role = $${paramCount}`);
        values.push(req.body.role);
        paramCount++;
      }

      // Handle privacy settings
      if (req.body.privacySettings) {
        const privacySettings = typeof req.body.privacySettings === 'string' 
          ? JSON.parse(req.body.privacySettings) 
          : req.body.privacySettings;
        
        updateFields.push(`privacysettings = $${paramCount}`);
        values.push(privacySettings);
        paramCount++;
      }

      // Handle profile image
      if (req.files?.profileImage) {
        const profileImageFile = req.files.profileImage[0];
        
        // Delete old profile image if exists
        const oldProfileImage = existingUser.rows[0].profileimage;
        if (oldProfileImage) {
          const oldImagePath = 'uploads/profiles/' + path.basename(oldProfileImage);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }

        // Save new profile image path
        const imageRelativePath = `/uploads/profiles/${profileImageFile.filename}`;
        updateFields.push(`profileimage = $${paramCount}`);
        values.push(imageRelativePath);
        paramCount++;
      }

      // Handle cover photo
      if (req.files?.coverPhoto) {
        const coverPhotoFile = req.files.coverPhoto[0];
        
        // Delete old cover photo if exists
        const oldCoverPhoto = existingUser.rows[0].coverphoto;
        if (oldCoverPhoto) {
          const oldCoverPath = 'uploads/covers/' + path.basename(oldCoverPhoto);
          if (fs.existsSync(oldCoverPath)) {
            fs.unlinkSync(oldCoverPath);
          }
        }

        // Save new cover photo path
        const coverRelativePath = `/uploads/covers/${coverPhotoFile.filename}`;
        updateFields.push(`coverphoto = $${paramCount}`);
        values.push(coverRelativePath);
        paramCount++;
      }

      // Always update updatedAt
      updateFields.push(`updatedat = CURRENT_TIMESTAMP`);
      
      // Add UID as last parameter
      values.push(uid);

      const updateQuery = `
        UPDATE users 
        SET ${updateFields.join(', ')} 
        WHERE uid = $${paramCount} 
        RETURNING *
      `;

      const result = await pool.query(updateQuery, values);

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const updatedUser = result.rows[0];

      let message = "Profile updated successfully";
      if (req.files?.profileImage && req.files?.coverPhoto) {
        message = "Profile and cover photo updated successfully";
      } else if (req.files?.profileImage) {
        message = "Profile image updated successfully";
      } else if (req.files?.coverPhoto) {
        message = "Cover photo updated successfully";
      }

      res.json({
        success: true,
        message: message,
        data: updatedUser,
      });
    } catch (error) {
      console.error("Error updating user:", error);
      
      // Delete uploaded files if error occurred
      if (req.files) {
        if (req.files.profileImage) {
          req.files.profileImage.forEach(file => fs.unlinkSync(file.path));
        }
        if (req.files.coverPhoto) {
          req.files.coverPhoto.forEach(file => fs.unlinkSync(file.path));
        }
      }
      
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Update only profile image
  router.patch('/:uid/profile-image', uploadProfile.single('profileImage'), async (req, res) => {
    try {
      const uid = req.params.uid;
      
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No image file provided" });
      }

      // Check if user exists
      const existingUser = await pool.query('SELECT * FROM users WHERE uid = $1', [uid]);
      if (existingUser.rows.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Delete old profile image if exists
      const oldProfileImage = existingUser.rows[0].profileimage;
      if (oldProfileImage) {
        const oldImagePath = 'uploads/profiles/' + path.basename(oldProfileImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Save new profile image path
      const imageRelativePath = `/uploads/profiles/${req.file.filename}`;

      const result = await pool.query(
        'UPDATE users SET profileimage = $1, updatedat = CURRENT_TIMESTAMP WHERE uid = $2 RETURNING *',
        [imageRelativePath, uid]
      );

      res.json({
        success: true,
        message: "Profile image updated successfully",
        data: result.rows[0],
      });
    } catch (error) {
      console.error("Error updating profile image:", error);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Update only cover photo
  router.patch('/:uid/cover-photo', uploadCover.single('coverPhoto'), async (req, res) => {
    try {
      const uid = req.params.uid;
      
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No cover photo provided" });
      }

      // Check if user exists
      const existingUser = await pool.query('SELECT * FROM users WHERE uid = $1', [uid]);
      if (existingUser.rows.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Delete old cover photo if exists
      const oldCoverPhoto = existingUser.rows[0].coverphoto;
      if (oldCoverPhoto) {
        const oldCoverPath = 'uploads/covers/' + path.basename(oldCoverPhoto);
        if (fs.existsSync(oldCoverPath)) {
          fs.unlinkSync(oldCoverPath);
        }
      }

      // Save new cover photo path
      const coverRelativePath = `/uploads/covers/${req.file.filename}`;

      const result = await pool.query(
        'UPDATE users SET coverphoto = $1, updatedat = CURRENT_TIMESTAMP WHERE uid = $2 RETURNING *',
        [coverRelativePath, uid]
      );

      res.json({
        success: true,
        message: "Cover photo updated successfully",
        data: result.rows[0],
      });
    } catch (error) {
      console.error("Error updating cover photo:", error);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Update user (PUT) - without image
  router.put('/:uid', async (req, res) => {
    try {
      const uid = req.params.uid;
      const { name, email, age, role, privacySettings } = req.body;
      
      console.log(`Updating user ${uid} with:`, { name, email, age, role, privacySettings });
      
      const updateQuery = `
        UPDATE users 
        SET name = $1, email = $2, age = $3, role = $4, privacysettings = $5, updatedat = CURRENT_TIMESTAMP 
        WHERE uid = $6 
        RETURNING *
      `;
      
      const result = await pool.query(updateQuery, [name, email, age, role, privacySettings, uid]);
      
      console.log("Update result:", result.rowCount);
      
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const updatedUser = result.rows[0];

      res.json({ 
        success: true, 
        message: "User updated successfully", 
        data: updatedUser 
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Delete user profile image
  router.delete('/:uid/profile-image', async (req, res) => {
    try {
      const uid = req.params.uid;

      // Check if user exists
      const existingUser = await pool.query('SELECT * FROM users WHERE uid = $1', [uid]);
      if (existingUser.rows.length === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Delete image file if exists
      const oldImage = existingUser.rows[0].profileimage;
      if (oldImage) {
        const oldImagePath = 'uploads/profiles/' + path.basename(oldImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Update database
      const result = await pool.query(
        'UPDATE users SET profileimage = NULL, updatedat = CURRENT_TIMESTAMP WHERE uid = $1 RETURNING *',
        [uid]
      );

      res.json({
        success: true,
        message: "Profile image deleted successfully",
        data: result.rows[0]
      });
    } catch (error) {
      console.error("Error deleting profile image:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Delete user cover photo
  router.delete('/:uid/cover-photo', async (req, res) => {
    try {
      const uid = req.params.uid;

      // Check if user exists
      const existingUser = await pool.query('SELECT * FROM users WHERE uid = $1', [uid]);
      if (existingUser.rows.length === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Delete cover photo file if exists
      const oldCover = existingUser.rows[0].coverphoto;
      if (oldCover) {
        const oldCoverPath = 'uploads/covers/' + path.basename(oldCover);
        if (fs.existsSync(oldCoverPath)) {
          fs.unlinkSync(oldCoverPath);
        }
      }

      // Update database
      const result = await pool.query(
        'UPDATE users SET coverphoto = NULL, updatedat = CURRENT_TIMESTAMP WHERE uid = $1 RETURNING *',
        [uid]
      );

      res.json({
        success: true,
        message: "Cover photo deleted successfully",
        data: result.rows[0]
      });
    } catch (error) {
      console.error("Error deleting cover photo:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Update only lastLogin
  router.patch('/:uid/last-login', async (req, res) => {
    try {
      const uid = req.params.uid;
      
      console.log(`Updating lastLogin for user ${uid}`);

      const result = await pool.query(
        'UPDATE users SET lastlogin = CURRENT_TIMESTAMP, updatedat = CURRENT_TIMESTAMP WHERE uid = $1 RETURNING *',
        [uid]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      res.json({
        success: true,
        message: "Last login updated successfully",
        data: result.rows[0]
      });
    } catch (error) {
      console.error("Error updating last login:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Update privacy settings
  router.patch('/:uid/privacy', async (req, res) => {
    try {
      const uid = req.params.uid;
      const { privacySettings } = req.body;
      
      console.log(`Updating privacy for user ${uid}:`, privacySettings);
      
      if (!privacySettings) {
        return res.status(400).json({ success: false, message: "privacySettings is required" });
      }

      const result = await pool.query(
        'UPDATE users SET privacysettings = $1, updatedat = CURRENT_TIMESTAMP WHERE uid = $2 RETURNING *',
        [privacySettings, uid]
      );
      
      console.log("Privacy update result:", result.rowCount);
      
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      res.json({ 
        success: true, 
        message: "Privacy settings updated",
        data: result.rows[0] 
      });
    } catch (error) {
      console.error("Error updating privacy settings:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Update user role
  router.patch('/:uid/role', async (req, res) => {
    try {
      const uid = req.params.uid;
      const { role } = req.body;
      
      // Validate role
      const validRoles = ['user', 'admin', 'moderator'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid role. Must be one of: " + validRoles.join(', ') 
        });
      }

      const result = await pool.query(
        'UPDATE users SET role = $1, updatedat = CURRENT_TIMESTAMP WHERE uid = $2 RETURNING *',
        [role, uid]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      res.json({
        success: true,
        message: `User role updated to ${role}`,
        data: result.rows[0]
      });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Get users by role
  router.get('/role/:role', async (req, res) => {
    try {
      const role = req.params.role;
      
      const result = await pool.query(
        'SELECT * FROM users WHERE role = $1 ORDER BY createdat DESC',
        [role]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error("Error fetching users by role:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Delete user from PostgreSQL + Firebase Auth
router.delete('/:uid', async (req, res) => {
  try {
    const uid = req.params.uid;

    // Get user data first to delete images
    const userResult = await pool.query('SELECT * FROM users WHERE uid = $1', [uid]);
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      // Delete profile image if exists
      if (user.profileimage) {
        const imagePath = 'uploads/profiles/' + path.basename(user.profileimage);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      // Delete cover photo if exists
      if (user.coverphoto) {
        const coverPath = 'uploads/covers/' + path.basename(user.coverphoto);
        if (fs.existsSync(coverPath)) {
          fs.unlinkSync(coverPath);
        }
      }
    }

    // Delete from PostgreSQL
    const result = await pool.query('DELETE FROM users WHERE uid = $1', [uid]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found in PostgreSQL" });
    }

    // Try to delete from Firebase Auth (if admin is available and initialized)
    let firebaseMessage = '';
    try {
      // Check if admin is available and Firebase app is initialized
      if (admin && admin.apps.length > 0) {
        await admin.auth().deleteUser(uid);
        firebaseMessage = ' and Firebase Auth';
        console.log(`✅ User ${uid} deleted from Firebase Auth`);
      } else {
        firebaseMessage = ' (Firebase skipped - not initialized)';
        console.log(`⚠️  Firebase not initialized, skipping Firebase delete for ${uid}`);
      }
    } catch (firebaseError) {
      console.warn('⚠️  Firebase delete failed:', firebaseError.message);
      firebaseMessage = ' (Firebase delete failed)';
    }

    res.json({ 
      success: true, 
      message: `User deleted from PostgreSQL${firebaseMessage}` 
    });

  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

  return router;
};