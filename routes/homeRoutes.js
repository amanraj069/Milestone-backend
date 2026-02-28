const express = require("express");
const router = express.Router();
const home = require("../controllers/homeController");

router.get("/home", home.getHome);
router.get("/jobs/api", home.getPublicJobs);
router.get("/jobs/api/:jobId", home.getJobDetail);
router.get("/jobs/:jobId/applicants", home.getJobApplicants);
router.get("/freelancer/:freelancerId", home.getFreelancerPublicProfile);

module.exports = router;
