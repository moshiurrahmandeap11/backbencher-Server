const express = require("express");

module.exports = (pool, admin) => {
    const router = express.Router();

    // ✅ GET site settings
    router.get("/", async (req, res) => {
        try {
            const result = await pool.query(
                'SELECT * FROM site_settings ORDER BY id DESC LIMIT 1'
            );

            if (result.rows.length === 0) {
                // Default settings return করো যদি data না থাকে
                return res.json({
                    success: true,
                    data: {
                        site_name: 'Backbencher Coder',
                        site_description: 'Empowering developers worldwide',
                        site_url: 'https://backbenchercoder.com',
                        contact_email: 'info@backbenchercoder.com',
                        maintenance_mode: false,
                        allow_registrations: true
                    }
                });
            }

            res.json({
                success: true,
                data: result.rows[0]
            });

        } catch (error) {
            console.error("Error fetching site settings:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch site settings",
                error: error.message
            });
        }
    });

    // ✅ UPDATE site settings
    router.put("/", async (req, res) => {
        try {
            const {
                site_name,
                site_description,
                site_url,
                contact_email,
                maintenance_mode,
                allow_registrations
            } = req.body;

            // Validation
            if (!site_name || !site_description || !site_url || !contact_email) {
                return res.status(400).json({
                    success: false,
                    message: "All fields are required"
                });
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contact_email)) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid contact email"
                });
            }

            // URL validation
            const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
            if (!urlRegex.test(site_url)) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid site URL"
                });
            }

            // Check if settings already exist
            const existingSettings = await pool.query(
                'SELECT * FROM site_settings ORDER BY id DESC LIMIT 1'
            );

            let result;
            
            if (existingSettings.rows.length > 0) {
                // Update existing settings
                result = await pool.query(
                    `UPDATE site_settings 
                     SET site_name = $1, site_description = $2, site_url = $3, 
                         contact_email = $4, maintenance_mode = $5, allow_registrations = $6,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $7 
                     RETURNING *`,
                    [
                        site_name,
                        site_description,
                        site_url,
                        contact_email,
                        maintenance_mode,
                        allow_registrations,
                        existingSettings.rows[0].id
                    ]
                );
            } else {
                // Insert new settings
                result = await pool.query(
                    `INSERT INTO site_settings 
                     (site_name, site_description, site_url, contact_email, maintenance_mode, allow_registrations) 
                     VALUES ($1, $2, $3, $4, $5, $6) 
                     RETURNING *`,
                    [
                        site_name,
                        site_description,
                        site_url,
                        contact_email,
                        maintenance_mode,
                        allow_registrations
                    ]
                );
            }

            res.json({
                success: true,
                message: "Site settings updated successfully",
                data: result.rows[0]
            });

        } catch (error) {
            console.error("Error updating site settings:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update site settings",
                error: error.message
            });
        }
    });

    // ✅ PATCH site settings status (Maintenance mode toggle)
    router.patch("/status", async (req, res) => {
        try {
            const { maintenance_mode, allow_registrations } = req.body;

            // Check if settings exist
            const existingSettings = await pool.query(
                'SELECT * FROM site_settings ORDER BY id DESC LIMIT 1'
            );

            let result;

            if (existingSettings.rows.length > 0) {
                // Update existing settings
                if (maintenance_mode !== undefined && allow_registrations !== undefined) {
                    result = await pool.query(
                        `UPDATE site_settings 
                         SET maintenance_mode = $1, allow_registrations = $2, updated_at = CURRENT_TIMESTAMP
                         WHERE id = $3 
                         RETURNING *`,
                        [
                            maintenance_mode,
                            allow_registrations,
                            existingSettings.rows[0].id
                        ]
                    );
                } else if (maintenance_mode !== undefined) {
                    result = await pool.query(
                        `UPDATE site_settings 
                         SET maintenance_mode = $1, updated_at = CURRENT_TIMESTAMP
                         WHERE id = $2 
                         RETURNING *`,
                        [
                            maintenance_mode,
                            existingSettings.rows[0].id
                        ]
                    );
                } else if (allow_registrations !== undefined) {
                    result = await pool.query(
                        `UPDATE site_settings 
                         SET allow_registrations = $1, updated_at = CURRENT_TIMESTAMP
                         WHERE id = $2 
                         RETURNING *`,
                        [
                            allow_registrations,
                            existingSettings.rows[0].id
                        ]
                    );
                }
            } else {
                // Insert new settings with default values
                result = await pool.query(
                    `INSERT INTO site_settings 
                     (site_name, site_description, site_url, contact_email, maintenance_mode, allow_registrations) 
                     VALUES ($1, $2, $3, $4, $5, $6) 
                     RETURNING *`,
                    [
                        'Backbencher Coder',
                        'Empowering developers worldwide',
                        'https://backbenchercoder.com',
                        'info@backbenchercoder.com',
                        maintenance_mode || false,
                        allow_registrations !== undefined ? allow_registrations : true
                    ]
                );
            }

            res.json({
                success: true,
                message: "Site status updated successfully",
                data: result.rows[0]
            });

        } catch (error) {
            console.error("Error updating site status:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update site status",
                error: error.message
            });
        }
    });

    // ✅ GET maintenance status (for main.tsx)
    router.get("/maintenance-status", async (req, res) => {
        try {
            const result = await pool.query(
                'SELECT maintenance_mode FROM site_settings ORDER BY id DESC LIMIT 1'
            );

            const maintenance_mode = result.rows.length > 0 ? result.rows[0].maintenance_mode : false;

            res.json({
                success: true,
                maintenance_mode: maintenance_mode
            });

        } catch (error) {
            console.error("Error fetching maintenance status:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch maintenance status",
                error: error.message
            });
        }
    });

    // ✅ GET site settings status (for registration check)
    router.get("/status", async (req, res) => {
        try {
            const result = await pool.query(
                'SELECT maintenance_mode, allow_registrations FROM site_settings ORDER BY id DESC LIMIT 1'
            );

            const settings = result.rows.length > 0 ? result.rows[0] : {
                maintenance_mode: false,
                allow_registrations: true
            };

            res.json({
                success: true,
                data: settings
            });

        } catch (error) {
            console.error("Error fetching site status:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch site status",
                error: error.message
            });
        }
    });

    // ✅ RESET to default settings
    router.post("/reset", async (req, res) => {
        try {
            // Delete all existing settings
            await pool.query('DELETE FROM site_settings');

            // Insert default settings
            const result = await pool.query(
                `INSERT INTO site_settings 
                 (site_name, site_description, site_url, contact_email, maintenance_mode, allow_registrations) 
                 VALUES ($1, $2, $3, $4, $5, $6) 
                 RETURNING *`,
                [
                    'Backbencher Coder',
                    'Empowering developers worldwide',
                    'https://backbenchercoder.com',
                    'info@backbenchercoder.com',
                    false,
                    true
                ]
            );

            res.json({
                success: true,
                message: "Site settings reset to default",
                data: result.rows[0]
            });

        } catch (error) {
            console.error("Error resetting site settings:", error);
            res.status(500).json({
                success: false,
                message: "Failed to reset site settings",
                error: error.message
            });
        }
    });

    return router;
};