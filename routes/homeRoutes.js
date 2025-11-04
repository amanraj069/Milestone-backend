const express = require("express");
const router = express.Router();
const home = require("../controllers/homeController");

router.get("/home", home.getHome);
router.get("/jobs/api", home.getPublicJobs);
router.get("/jobs/api/:jobId", home.getJobDetail);

module.exports = router;
