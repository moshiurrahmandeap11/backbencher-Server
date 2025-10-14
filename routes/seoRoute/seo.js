const express = require("express");

module.exports = (pool, admin) => {
    const router = express.Router();

    // ✅ GET SEO settings
    router.get("/", async (req, res) => {
        try {
            const result = await pool.query(
                'SELECT site_name, site_description, site_url, contact_email FROM site_settings ORDER BY id DESC LIMIT 1'
            );

            let seoData;
            
            if (result.rows.length === 0) {
                // Default SEO data
                seoData = {
                    site_name: 'Backbencher Coder',
                    site_description: 'Empowering developers worldwide with coding resources, tutorials, and community support',
                    site_url: 'https://backbenchercoder.com',
                    contact_email: 'info@backbenchercoder.com'
                };
            } else {
                seoData = result.rows[0];
            }

            res.json({
                success: true,
                data: seoData
            });

        } catch (error) {
            console.error("Error fetching SEO settings:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch SEO settings",
                error: error.message
            });
        }
    });

    return router;
};