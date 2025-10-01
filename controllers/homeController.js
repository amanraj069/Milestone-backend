exports.getHome = (req, res) => {
  let dashboardRoute = "";
  if (req.session && req.session.user) {
    switch (req.session.user.role) {
      case "Admin":
        dashboardRoute = "/adminD/profile";
        break;
      case "Employer":
        dashboardRoute = "/employerD/profile";
        break;
      case "Freelancer":
        dashboardRoute = "/freelancerD/profile";
        break;
    }
  }
  return res.json({ user: req.session?.user || null, dashboardRoute });
};
