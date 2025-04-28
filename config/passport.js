const passport = require("passport");
const googleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
const env = require("dotenv").config();

passport.use(
  new googleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
          return done(null, user);
        } else {
          // Create a new user if they don't exist
          user = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
          });
        }

        //  Save new user
        await user.save();
        return done(null, user); // Return the new user
      } catch (error) {
        return done(error, null); 
      }
    }
  )
);
// Serialize user to store the user ID in the session
passport.serializeUser((user, done) => {
  done(null, user.id); // store user ID in session
});

// Deserialize user from session to retrieve full user data
passport.deserializeUser((id,done) => {
  User.findById(id)
    .then((user) => {
      done(null, user); // Pass the user object to req.user
    })
    .catch((err) => {
      done(err, null);  // Handle errors
    });
});

module.exports = passport;
