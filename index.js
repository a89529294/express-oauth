require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);

const app = express();

const googleRedirectUri = "http://localhost:2400/google/callback";

app.set("view engine", "ejs");
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
    store: new SQLiteStore(),
  })
);

app.get("/", function (req, res) {
  if (req.session.user) {
    if (req.session.user.isGoogle) return res.redirect("/google-success");
    return res.redirect("/success");
  }

  res.render("pages/index", {
    client_id: process.env.GITHUB_CLIENT_ID,
    google_client_id: process.env.GOOGLE_CLIENT_ID,
    google_redirect_uri: googleRedirectUri,
  });
});

// Declare callback route for Github
app.get("/github/callback", (req, res) => {
  // The req.query object has the query params that were sent to this route.
  const requestToken = req.query.code;

  fetch(
    `https://github.com/login/oauth/access_token?client_id=${process.env.GITHUB_CLIENT_ID}&client_secret=${process.env.GITHUB_CLIENT_SECRET}&code=${requestToken}`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
      },
    }
  )
    .then((v) => v.json())
    .then((response) => {
      console.log(response);
      return fetch("https://api.github.com/user", {
        headers: {
          Authorization: `token ${response.access_token}`,
        },
      });
    })
    .then((v) => v.json())
    .then((response) => {
      console.log(response);
      req.session.user = response;
      res.redirect("/success");
    });
});

// Declare callback route for Google
app.get("/google/callback", (req, res) => {
  //
  console.log(res);
  const data = {
    code: req.query.code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: googleRedirectUri,
    grant_type: "authorization_code",
  };

  fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: JSON.stringify(data),
  })
    .then((r) => r.json())
    .then(async (response) => {
      // response.id_token is a jwt, extract sub field from payload for an unique identifier
      console.log(response);
      const accessToken = response.access_token;
      const refreshToken = response.refresh_token;

      const options = {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      };

      fetch(
        "https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses",
        options
      )
        .then((r) => r.json())
        .then((r) => {
          console.log(r);
          req.session.user = {
            isGoogle: true,
            name: r.names[0].displayName,
            email: r.emailAddresses[0].value,
          };
          res.redirect("/");
        });
    });
});

app.get("/success", function (req, res) {
  res.render("pages/success", { userData: req.session.user });
});

app.get("/google-success", function (req, res) {
  res.render("pages/google-success", { userData: req.session.user });
});

app.get("/logout", function (req, res) {
  req.session.destroy();
  res.clearCookie("connect.sid");
  res.redirect("/");
});

const port = process.env.PORT || 2400;
app.listen(port, () => console.log("App listening on port " + port));
