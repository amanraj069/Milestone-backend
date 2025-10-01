const express = require("express");
const router = express.Router();
const home = require("../controllers/homeController");

router.get("/home", home.getHome);

module.exports = router;
